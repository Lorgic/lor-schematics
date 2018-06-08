import { Rule, chain, Tree, SchematicContext, externalSchematic, SchematicsException, mergeWith, apply, url, filter, template, move } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';
import * as ts from 'typescript';
import { dasherize, classify } from '@angular-devkit/core/src/utils/strings';
import { findNode, getSourceFile, InsertChange, RemoveChange, decomposeName } from '../utils/utils';
import { strings } from '@angular-devkit/core';

interface ExtendedSchemaOptions extends SchemaOptions{
    parentName: string;
    concatName: string;
    path: string;
}

export default function (opts: SchemaOptions): Rule {
    if(!opts.actions) throw new SchematicsException(`Can't create any actions: use at least one --reducer or --effect ( --reducer=['"reducerOne", "etc"'] )`)
    opts.actions = JSON.parse(opts.actions);
    if(!Array.isArray(opts.actions)) throw new SchematicsException(`actions couldnt be parsed as JSON to array. Use format ['"item", "item2"']`);
    opts.actions.forEach((element: string, index: number) => opts.actions[index] = classify(element));

    const decName = decomposeName(opts.name);

    const options: ExtendedSchemaOptions = {
        name: decName.name,
        parentName: decName.parentName,
        concatName: decName.concatName,
        path: decName.path,
        actions: opts.actions
    } 
    
    return chain([
        (tree: Tree, _context: SchematicContext) => {
            // IF local index.ts does not exist, create it with right parameter
            const filePath = options.path ;
            
            const sourceFile = getSourceFile(`${filePath}/index.ts`, tree);
            if(!sourceFile){
                
                return mergeWith(apply(url('./files'), [
                    filter(path => !!path.match(/index\.ts$/)),
                    template({
                        ...strings,
                        name: options.name
                    }),
                    move(filePath)
                ]))(tree, _context);
            }
            // ELSE update it with parameter
            let declarationRecorder = tree.beginUpdate(`${filePath}/index.ts`);
            declarationRecorder.insertLeft(0, `export * from './${dasherize(options.name)}.actions';\n`)
            tree.commitUpdate(declarationRecorder);
            return tree;
        },
        (tree: Tree, _context: SchematicContext) => {
            return mergeWith(apply(url('./files'), [
                filter(path => !!path.match(/actions\.ts$/)),
                template({
                    ...strings,
                    name: options.name,
                    concatName: options.concatName
                  }),
                move(options.path)
            ]))(tree, _context);
        },
        (tree: Tree, _context: SchematicContext) => {
            
            const filePath = `${options.path}/${dasherize(options.name)}.actions.ts`;
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);

            // INSERT
            const insertChanges = buildActionInjectionChanges(sourceFile, options);
            let declarationRecorder = tree.beginUpdate(filePath);
            insertChanges.forEach((change: InsertChange) => {
                declarationRecorder.insertLeft(change.startIndex, change.insertText);
            });
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
    if(!enumDeclarationNode) throw new SchematicsException('could not find enum declaration in Action class ');
    
    //Add Enum parameters
    const enumFirstPunctuationNode = findNode(enumDeclarationNode, ts.SyntaxKind.FirstPunctuation, '{');
    if(!enumFirstPunctuationNode) throw new SchematicsException('expect enum ActionTypes to have an opening bracket');
    const startIndex = enumFirstPunctuationNode.end;
    
    const actions: string[] = options.actions;
    if(actions) actions.forEach(action => {
        const identifier = (options.parentName) ? classify(options.parentName) : classify(options.name);
        const insertText = `\n  ${action} = '[${identifier}] ${action}',`;
        changes.push({startIndex, insertText});
    });

    return changes;
}

function getClassChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[] {
    const changes: InsertChange[] = [];
    
    //Find default Class
    const enumDeclarationNode = findNode(sourceFile, ts.SyntaxKind.EnumDeclaration, 'export enum');
    if(!enumDeclarationNode) throw new SchematicsException('Did not find end of enum');

    //Insert after enum
    const startIndex = enumDeclarationNode.end;
    const actions: string[] = options.actions;
    if(actions) actions.forEach(element => {
        let insertText = `\n\nexport class ${element} implements Action {` + 
        `\n  readonly type = ${options.concatName}ActionTypes.${element};\n}`;
        changes.push({startIndex, insertText});
    });
    return changes;
}

function getTypeChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[] {
    const changes: InsertChange[] = [];

    const typeNode = findNode(sourceFile, ts.SyntaxKind.TypeAliasDeclaration, 'export type');
    if(!typeNode) throw new SchematicsException('Did not find end of enum');;
    const firstAssignmentNode = findNode(sourceFile, ts.SyntaxKind.FirstAssignment, '=');
    if(!firstAssignmentNode) throw new SchematicsException('Did not find end of enum');;
    
    // Insert after Default type
    let startIndex = firstAssignmentNode.end;
    const actions: string[] = options.actions;
    if(actions) actions.forEach((element, index:number) => {
        let insertText = (Object.is(actions.length -1, index)) ?
            `\n  ${element}` :
            `\n  ${element} |`;
        changes.push({startIndex, insertText});
    });
    
    return changes;
}