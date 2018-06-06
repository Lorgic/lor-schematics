import { IDecomposedName } from './../utils/utils';
import { Rule, chain, SchematicsException, schematic, Tree, SchematicContext, apply, url, template, mergeWith, move } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';
import { dasherize, camelize, classify } from '@angular-devkit/core/src/utils/strings';
import { getSourceFile, showTree, findNode, decomposeName, InsertChange } from '../utils/utils';
import { createIndexedAccessTypeNode } from 'typescript';
import * as ts from 'typescript';
export default function (opts: SchemaOptions): Rule {
    const actions: string[] = [];
    if(opts.effects){ 
        opts.effects = JSON.parse(opts.effects);
        if(!Array.isArray(opts.effects)) throw new SchematicsException('Expected effects to parse to an array');
        actions.push(...opts.effects);
    }; 
    if(opts.reducers){ 
        opts.reducers = JSON.parse(opts.reducers);
        if(!Array.isArray(opts.reducers)) throw new SchematicsException('Expected reducers to parse to an array');
        actions.push(...opts.reducers);
    };
    
   
    
    return chain([
        
        (tree: Tree, _context: SchematicContext) => {
            const filePath = `src/state`;
            let sourceFile = getSourceFile(filePath + '/index.ts', tree);
            if(!sourceFile){
                return mergeWith(apply(url('./files'), [move(filePath)]))(tree, _context);
            }
        },
        /* ***** MOVE THIS TO REDUCER Schematic
        (tree: Tree, _context: SchematicContext) => {
            //Find right node
            
            const filePath = `src/state/index.ts`;
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);
            
            const changes: InsertChange[] = [];
            const decName = decomposeName(opts.name);
            changes.push(getImportChange(sourceFile, decName));
            changes.push(getStateInterfaceChange(sourceFile, decName));
            
            let declarationRecorder = tree.beginUpdate(filePath);
            changes.forEach((change) => {
                declarationRecorder.insertLeft(change.startIndex, change.insertText);
            });
            tree.commitUpdate(declarationRecorder);
            return tree;
        } */
        // schematic('nn-ngrx-action', {
        //     name: opts.name,
        //     actions: JSON.stringify(actions),
        // }),
        // schematic('nn-ngrx-effect', {
        //     name: opts.name,
        //     effects: JSON.stringify(opts.effects),
        // }),
        /* TODO: 
        schematic('nn-ngrx-reducer', {
            name: opts.name,
            reducers: JSON.stringify(reducers),
        }),
        schematic('nn-ngrx-selector', {
            name: opts.name
        }),
        
        */
    ]);
}
function getStateInterfaceChange(sourceFile: ts.Node, decName: IDecomposedName): InsertChange{
    const interfaceNode = findNode(sourceFile, ts.SyntaxKind.InterfaceDeclaration, 'export interface State');
    if(!interfaceNode) throw new SchematicsException('No interface called State was found in index.ts');
    const firstPunctuationNode = findNode(interfaceNode, ts.SyntaxKind.FirstPunctuation, '{');
    if(!firstPunctuationNode) throw new SchematicsException('Could not find opening bracket in interface');
    //Insert into node
    
    const startIndex = firstPunctuationNode.end;     
    const name = (decName.parentName) ? camelize(decName.parentName) + classify(decName.name) : camelize(decName.name);
    let insertText = `\n  ${name}: from${decName.parentName}${decName.name}.${decName.parentName}${decName.name}State;`
    return {startIndex, insertText};

}
function getImportChange(sourceFile: ts.Node, decName: IDecomposedName): InsertChange{
    const startIndex = 0
    const folderPath: string = (decName.parentName) ? dasherize(decName.parentName) + '/' + dasherize(decName.name) : dasherize(decName.name)
    const insertText = `import * as from${decName.parentName}${decName.name} from './${folderPath}'\n`
    return {startIndex, insertText};
}