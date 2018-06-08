import { reducers } from './../nn-state/files/index';
import { Rule, chain, Tree, SchematicContext, externalSchematic, SchematicsException, mergeWith, apply, url, template, move, filter,  } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';
import * as ts from 'typescript';
import { dasherize, classify, camelize } from '@angular-devkit/core/src/utils/strings';
import { getSourceFile, InsertChange, findNode, decomposeName, IDecomposedName, showTree, showFileTree } from '../utils/utils';
import { strings } from '@angular-devkit/core';
// import { findNode, getSourceFile, InsertChange, RemoveChange, showTree } from '../utils/utils';

interface ExtendedSchemaOptions extends SchemaOptions{
    parentName: string;
    concatName: string;
    path: string;
}

export default function (opts: SchemaOptions): Rule {
    if(!opts.reducers) throw new SchematicsException('Define at least one reducer with --reducer //--reducer=[\'"LoadSomething"], "CreateSomething"\']');
    opts.reducers = JSON.parse(opts.reducers);
    if(!Array.isArray(opts.reducers)) throw new SchematicsException(`reducers in --reducer could not be parsed as JSON to array. Use format ['"item", "item2"']`);
    opts.reducers.forEach((element: string, index: number) => opts.reducers[index] = classify(element));
    console.log('Reducers', 1);
    const decName = decomposeName(opts.name);
    console.log('x', decName.path)
    const options: ExtendedSchemaOptions = {
        path: decName.path,
        name: decName.name,
        parentName: decName.parentName,
        concatName: decName.concatName,
        reducers: opts.reducers
    } 
    
    return chain([
         
        (tree: Tree, _context: SchematicContext) => {
            //UPDATE state/index.ts
            
            const filePath = `src/state/index.ts`;
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);
            
            const changes: InsertChange[] = [];
            //TODO this, decomposition already done!

            changes.push(getImportChangeIndexTs(sourceFile, options));
            changes.push(getStateInterfaceChangeIndexTs(sourceFile, options));
            changes.push(getReducerObjectChangesIndexTs(sourceFile, options));

            let declarationRecorder = tree.beginUpdate(filePath);
            changes.forEach((change) => {
                declarationRecorder.insertLeft(change.startIndex, change.insertText);
            });
            tree.commitUpdate(declarationRecorder);
            return tree;
        },
        (tree: Tree, _context: SchematicContext) => {
            // IF index.ts does not exist, create it with right parameter
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
            // ELSE update it with right parameter
            let declarationRecorder = tree.beginUpdate(`${filePath}/index.ts`);
            declarationRecorder.insertLeft(0, `export * from './${dasherize(options.name)}.reducer';\n`)
            tree.commitUpdate(declarationRecorder);
            return tree;
        },
        (tree: Tree, _context: SchematicContext) => {
            console.log('inserting into', options.path);
            return mergeWith(apply(url('./files'), [
                filter(path => !!path.match(/reducer\.ts$/)),
                template({
                    ...strings,
                    name: options.name,
                    concatName: options.concatName
                  }),
                move(options.path)
            ]))(tree, _context);
            
        },
        (tree: Tree, _context: SchematicContext) => {
            const filePath = `${options.path}/${dasherize(options.name)}.reducer.ts`;
            
            console.log('r', tree.exists(filePath), options.path);
            showFileTree(tree, 'src/state');
            console.log('*********************')
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);

            const insertChanges = getReducerChanges(sourceFile, options);
            let declarationRecorder = tree.beginUpdate(filePath);
            insertChanges.forEach((change: InsertChange) => {
                declarationRecorder.insertLeft(change.startIndex, change.insertText);
            });
            tree.commitUpdate(declarationRecorder);
            console.log('Reducers', 2);
            return tree;
        },
        /* 
            TODO: Add spec file
        */
    ]);
}
function getStateInterfaceChangeIndexTs(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange{
    const interfaceNode = findNode(sourceFile, ts.SyntaxKind.InterfaceDeclaration, 'export interface State');
    if(!interfaceNode) throw new SchematicsException('No interface called State was found in index.ts');
    const firstPunctuationNode = findNode(interfaceNode, ts.SyntaxKind.FirstPunctuation, '{');
    if(!firstPunctuationNode) throw new SchematicsException('Could not find opening bracket in interface');
    
    
    const startIndex = firstPunctuationNode.end;     
    let insertText = `\n  ${camelize(options.concatName)}: from${options.concatName}.${options.concatName}State;`
    return {startIndex, insertText};
}
function getImportChangeIndexTs(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange{
    const startIndex = 0
    const folderPath: string = (options.parentName) ? dasherize(options.parentName) + '/' + dasherize(options.name) : dasherize(options.name)
    const insertText = `import * as from${options.concatName} from './${folderPath}';\n`;
    return {startIndex, insertText};
}

function getReducerObjectChangesIndexTs(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange{
    const constReducerNode = findNode(sourceFile, ts.SyntaxKind.VariableDeclarationList, 'const reducer')
    if(!constReducerNode) throw new SchematicsException('expected to find export const reducer');
    const firstPunctuationNode = findNode(constReducerNode, ts.SyntaxKind.FirstPunctuation, '{');
    if(!firstPunctuationNode) throw new SchematicsException('expected to find opening bracket in export const reducer');
    const startIndex = firstPunctuationNode.end;
    const insertText = `\n  ${camelize(options.concatName)}: from${options.concatName}.reducer,`;
    return {startIndex, insertText};
}

function getReducerChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[]{
    const changes: InsertChange[] = [];
    
    const switchStatementNode = findNode(sourceFile, ts.SyntaxKind.SwitchStatement, 'action.type');
    if(!switchStatementNode) throw new SchematicsException('expected to find a switch statement');
    const firstPunctuationNode= findNode(switchStatementNode, ts.SyntaxKind.FirstPunctuation, '{');
    if(!firstPunctuationNode) throw new SchematicsException('expected to find an opening bracket in switch statement');

    const startIndex = firstPunctuationNode.end;    
    options.reducers.forEach((reducer: string) => {
        
        const insertText = 
        `\n    case from${options.concatName}Actions.${options.concatName}ActionTypes.${reducer}: {` +
        `\n      // prepare variables for state changes` + 
        `\n      return /*{ ...state, partOfStateToChange: changeInput} } */state;` +
        `\n    }` +
        `\n`;
        changes.push({startIndex, insertText})
    });
    return changes;
}
