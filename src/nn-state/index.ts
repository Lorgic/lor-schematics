import { Rule, chain, Tree, SchematicContext, externalSchematic, SchematicsException,  } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';
import * as ts from 'typescript';
import { dasherize, classify } from '@angular-devkit/core/src/utils/strings';
import { findNode, getSourceFile, InsertChange, RemoveChange } from '../utils/utils';

interface ExtendedSchemaOptions extends SchemaOptions{
    parentName: string;
    actions?: string[]
}

export default function (opts: SchemaOptions): Rule {
    const actions: string[] = [];
    if(opts.effects){ 
        opts.effects = JSON.parse(opts.effects)
        if(!Array.isArray(opts.effects)) throw new SchematicsException('Expected effects to parse to an array');
        actions.push(...opts.effects);
    }; 
    if(opts.reducers){ 
        opts.reducers = JSON.parse(opts.reducers)
        if(!Array.isArray(opts.reducers)) throw new SchematicsException('Expected reducers to parse to an array');
        actions.push(...opts.reducers);
    };
    
    
    let path: string = 'src/state'
    let lastIndex:number = opts.name.lastIndexOf('/');
    let parentName:string = opts.name.substr(0, lastIndex)
    if(lastIndex > -1){
        path = path + '/' + dasherize(parentName);
        opts.name = opts.name.substr(lastIndex + 1);
    }
    const options: ExtendedSchemaOptions = {
        name: opts.name,
        parentName: parentName,
        effects: opts.effects,
        reducers: opts.reducers,
        actions: actions
    } 
    
    return chain([
       
        externalSchematic('@ngrx/schematics', 'action', {
            flat: false,
            group: false,
            name: options.name,
            path: path
        }),
        (tree: Tree, _context: SchematicContext) => {
            const filePath = `${path}/${dasherize(options.name)}/${dasherize(options.name)}.actions.ts`;
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);
            
            // INSERT
            const insertChanges = buildActionInjectionChanges(sourceFile, options);
            let declarationRecorder = tree.beginUpdate(filePath);
            insertChanges.forEach((change: InsertChange) => {
                declarationRecorder.insertLeft(change.startIndex, change.insertText);
            });
            tree.commitUpdate(declarationRecorder);

            // REMOVE
            sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);
            const removeChanges = buildActionRemoveChanges(sourceFile, options);
            declarationRecorder = tree.beginUpdate(filePath);
            removeChanges.forEach((change: RemoveChange) => {
                declarationRecorder.remove(change.startIndex, change.length);
            })
            tree.commitUpdate(declarationRecorder); 

            return tree;
        },
    ]);
}

function buildActionInjectionChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[]{
    const injectionChanges: InsertChange[] = [];
    
    injectionChanges.push(...getEnumChanges(sourceFile, options));
    injectionChanges.push(...getClassChanges(sourceFile, options));
    injectionChanges.push(...getTypeChanges(sourceFile, options));

    return injectionChanges;
}
function getEnumChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[] {
    const changes: InsertChange[] = [];

    
    const enumDeclarationNode = findNode(sourceFile, ts.SyntaxKind.EnumDeclaration, options.name + 'ActionTypes');
    if(!enumDeclarationNode){
        return [];
    }

    // Change Enum identifier
    if(options.parentName){
        const enumIdentifierNode = findNode(enumDeclarationNode, ts.SyntaxKind.Identifier, `${options.name}ActionTypes`)
        if(enumIdentifierNode) changes.push({startIndex: enumIdentifierNode.getStart(), insertText: options.parentName})
    }
    
    //Add Enum parameters
    const enumParameterListNode = findNode(enumDeclarationNode, ts.SyntaxKind.SyntaxList, '[' + options.name + ']');
    if(!enumParameterListNode) throw new SchematicsException('expect enum ActionTypes to have a parameter list');
    const parameterArray = enumParameterListNode.getChildren();
    const lastParameter = parameterArray[parameterArray.length-1];
    
    const actions = options.actions;
    if(actions) actions.forEach(element => {
        const identifier = (options.parentName) ? classify(options.parentName) : classify(options.name);
        const insertText = `\n  ${element} = '[${identifier}] ${element}',`;
        changes.push({startIndex: lastParameter.end, insertText});
    });

    return changes;
}

function getClassChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[] {
    const changes: InsertChange[] = [];
    
    //Find default Class
    const classNode = findNode(sourceFile, ts.SyntaxKind.ClassDeclaration, 'export class');
    if(!classNode) return [];

    //Insert after default class
    const startIndex = classNode.end;
    const actions = options.actions;
    if(actions) actions.forEach(element => {
        let insertText = `\n\nexport class ${element} implements Action {` + 
        `\n  readonly type = ${options.parentName}${options.name}ActionTypes.${element};\n}`;
        changes.push({startIndex, insertText});
    });
    return changes;
}

function getTypeChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[] {
    const changes: InsertChange[] = [];

    const typeNode = findNode(sourceFile, ts.SyntaxKind.TypeReference, 'Load');
    if(!typeNode) return [];

    // Change identifier if parentName exists
    if(options.parentName){
        let typeAliasNode = findNode(sourceFile, ts.SyntaxKind.TypeAliasDeclaration, `${options.name}Actions`)
        let identifierNode = (typeAliasNode) ? findNode(typeAliasNode,ts.SyntaxKind.Identifier, `${options.name}Actions` ): null;
        if(identifierNode) changes.push({startIndex: identifierNode.getStart(), insertText: options.parentName})
    }

    // Insert after Default type
    let startIndex = typeNode.end;
    const actions = options.actions;
    if(actions) actions.forEach((element, index) => {
        let insertText = (Object.is(actions.length -1, index)) ?
            `\n  ${element}` :
            `\n  ${element} |`;
        changes.push({startIndex, insertText});
    });
    
    return changes;
}
function buildActionRemoveChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): RemoveChange[]{
    const removeChanges: RemoveChange[] = [];

    removeChanges.push(removeInitialLoadType(sourceFile, options));
    removeChanges.push(removeInitialLoadClass(sourceFile, options));
    removeChanges.push(removeInitialLoadFromEnum(sourceFile, options));

    return removeChanges;
}
function removeInitialLoadFromEnum(sourceFile: ts.Node, options: ExtendedSchemaOptions): RemoveChange{
    const actionTypesNode = findNode(sourceFile, ts.SyntaxKind.EnumDeclaration, options.name + 'ActionTypes');
    if(!actionTypesNode) throw new SchematicsException('expect enum to have an EnumDeclaration ...ActionTypes');
    console.log(actionTypesNode.getText());
    const parameterListNode = findNode(actionTypesNode, ts.SyntaxKind.SyntaxList, '[' + options.name + ']');
    if(!parameterListNode) throw new SchematicsException('expect enum ActionTypes to have a parameter list');
    const parameterNodes = parameterListNode.getChildren();
    console.log(parameterNodes[0].getText(), parameterNodes[0].getStart(), parameterNodes[0].getText().length );
    return {startIndex: parameterNodes[0].getStart(), length: parameterNodes[0].getText().length + 3};
}
function removeInitialLoadClass(sourceFile: ts.Node, options: ExtendedSchemaOptions): RemoveChange {
    const classNode = findNode(sourceFile, ts.SyntaxKind.ClassDeclaration, `export class ${options.name}` );
    if(!classNode) throw new SchematicsException('expected there was an initial load class');
    return {startIndex: classNode.getStart(), length: classNode.getText().length + 2};
}
function removeInitialLoadType(sourceFile: ts.Node, options: ExtendedSchemaOptions): RemoveChange {
    const typeNode = findNode(sourceFile, ts.SyntaxKind.TypeReference, `Load${options.name}s`);
    if(!typeNode) throw new SchematicsException('expected there was an initial load in type'); ;
    return {startIndex: typeNode.getStart(), length: typeNode.getText().length + 3};
}