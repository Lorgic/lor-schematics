import { Rule, chain, Tree, SchematicContext, externalSchematic, SchematicsException, mergeWith, apply, url, filter, template, move,  } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';
import * as ts from 'typescript';
import { dasherize, classify } from '@angular-devkit/core/src/utils/strings';
import { getSourceFile, InsertChange, findNode, decomposeName, showTree, showFileTree } from '../utils/utils';
import { strings } from '@angular-devkit/core';
// import { findNode, getSourceFile, InsertChange, RemoveChange, showTree } from '../utils/utils';

interface ExtendedSchemaOptions extends SchemaOptions{
    concatName: string;
    path: string;
}

export default function (opts: SchemaOptions): Rule {
    
    if(!opts.effects) throw new SchematicsException('Define at least one effect with --effect //--effect=[\'"SaveSomething"], "UpdateSomething"\']');
    opts.effects= JSON.parse(opts.effects);
    if(!Array.isArray(opts.effects)) throw new SchematicsException(`effects in --effect could not be parsed as JSON to array. Use format ['"item", "item2"']`);
    opts.effects.forEach((element: string, index: number) => opts.effects[index] = classify(element));
    console.log('Effects', 1);

    const decName = decomposeName(opts.name);
    
    const options: ExtendedSchemaOptions = {
        path: decName.path,
        name: decName.name,
        concatName: decName.concatName,
        effects: opts.effects
    } 
    
    return chain([
        (tree: Tree, _context: SchematicContext) => {
            //UPDATE state/index.ts
            console.log('e0');
            const filePath = `src/state/index.ts`;
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);
            
            const changes: InsertChange[] = [];
            //TODO this, decomposition already done!
            changes.push(getEffectArrayChangesIndexTs(sourceFile, options));

            let declarationRecorder = tree.beginUpdate(filePath);
            changes.forEach((change) => {
                declarationRecorder.insertLeft(change.startIndex, change.insertText);
            });
            tree.commitUpdate(declarationRecorder);
            return tree;
        },
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
            declarationRecorder.insertLeft(0, `export * from './${dasherize(options.name)}.effects';\n`)
            tree.commitUpdate(declarationRecorder);
            return tree;
        },
        (tree: Tree, _context: SchematicContext) => {
            console.log('inserting into', options.path);
            return mergeWith(apply(url('./files'), [
                filter(path => !!path.match(/effects\.ts$/)),
                template({
                    ...strings,
                    name: options.name,
                    concatName: options.concatName
                  }),
                move(options.path)
            ]))(tree, _context);
        },
        (tree: Tree, _context: SchematicContext) => {
            const filePath = `${options.path}/${dasherize(options.name)}.effects.ts`;
            console.log('e', tree.exists(filePath), options.path);
            showFileTree(tree, 'src/state');
            console.log('*********************')
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);
            const insertChanges = getEffectChanges(sourceFile, options);
            let declarationRecorder = tree.beginUpdate(filePath);
            insertChanges.forEach((change: InsertChange) => {
                declarationRecorder.insertLeft(change.startIndex, change.insertText);
            });
            tree.commitUpdate(declarationRecorder);
            console.log('Effects', 2);
            return tree;
        },
        /* 
            TODO: Add spec file
        */
    ]);
}
function getEffectArrayChangesIndexTs(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange{
    const constEffectsNode = findNode(sourceFile, ts.SyntaxKind.VariableDeclarationList, 'const effects')
    if(!constEffectsNode) throw new SchematicsException('expected to find export const effects');
    const openBracketTokenNode = findNode(constEffectsNode, ts.SyntaxKind.OpenBracketToken, '[');
    if(!openBracketTokenNode) throw new SchematicsException('expected to find opening bracket in export const effects');
    
    const startIndex = openBracketTokenNode.end;
    const insertText = `\n  from${(options.concatName)}.${(options.concatName)}Effects,`;
    return {startIndex, insertText};
}

function getEffectChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[] {
    const changes: InsertChange[] = [];

    //Find default Class
    const classNode = findNode(sourceFile, ts.SyntaxKind.ClassDeclaration, 'export class');
    if(!classNode) throw new SchematicsException('expected to find a class');

    const firstPunctuationNode = findNode(classNode, ts.SyntaxKind.FirstPunctuation, '{');
    if(!firstPunctuationNode) throw new SchematicsException('expected class to have an opening bracket');;
    const startIndex = firstPunctuationNode.end;
    
    if(options.effects) options.effects.forEach((effect: string) => {
        const insertText = 
        `\n  @Effect() public ${effect}$: Observable<Action> = this.actions$` +
        `\n  .ofType(from${options.concatName}Actions.${options.concatName}ActionTypes.${effect})` +
        `\n  .pipe(` + 
        `${getEffectSpecificText(effect, options.concatName)}` +
        `\n  );`;
        changes.push({startIndex, insertText});
    });
    
    return changes;
}

function getEffectSpecificText(effect: string, concatName: string): string{
    
    if(effect.includes('Completed' || 'Fail')){
        const untilIndex = effect.includes('Completed') ? effect.indexOf('Completed'): effect.indexOf('Fail') ;
        const lengthOfKeyWord = 4; //'Load' or 'Save' 
        let baseEffectName: string = '';
        baseEffectName = effect.substr(lengthOfKeyWord, untilIndex - lengthOfKeyWord);
        
        return `\n    map((action: from${concatName}Actions.${effect}) => {` +
            `\n      // create input for UpdateAction` +
            `\n      return new from${concatName}Actions.Update${baseEffectName}(/* input */);` +
            `\n    })`;
    }else if(effect.includes('Load' || effect.includes('Send'))){
        return `\n    replaceThisMap/* switchMap or mergeMap */((action: from${concatName}Actions.${effect}) => {` +
        `\n      return someApi.getData()` +
        `\n        .pipe(` +
        `\n          map((${concatName} /*: {Add Typing} */) => {` +
        `\n            // create input for completedAction` +
        `\n            return new from${concatName}Actions.${effect}Completed(/* input */);` +
        `\n          }),` +
        `\n          catchError((error) => {` +
        `\n            // create input for errorAction` +
        `\n            return new from${concatName}Actions.${effect}Fail(/* input */);` +
        `\n          })` +
        `\n      );` +
        `\n    })`;
    }else if(effect.includes('Create')){
        const baseEffectName = effect.substr('Create'.length);
        return `\n    map((action: from${concatName}Actions.${effect}) => {` +
            `\n      // create input for SaveAction` +
            `\n      return new from${concatName}Actions.Save${baseEffectName}(/* input */);` + 
            `\n    })`;
    }
    return `\n/* Unrecognized effect type: known types are Create.. | Load.. | Load..Fail | Load..Completed | Send.. | Send..Fail | Send..Completed */`;
}
