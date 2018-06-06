import { Rule, chain, Tree, SchematicContext, externalSchematic, SchematicsException,  } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';
import * as ts from 'typescript';
import { dasherize, classify } from '@angular-devkit/core/src/utils/strings';
import { getSourceFile, InsertChange, findNode } from '../utils/utils';
// import { findNode, getSourceFile, InsertChange, RemoveChange, showTree } from '../utils/utils';

interface ExtendedSchemaOptions extends SchemaOptions{
    parentName: string;
}

export default function (opts: SchemaOptions): Rule {
    opts.effects= JSON.parse(opts.effects);
    let path: string = 'src/state'
    const lastIndex:number = opts.name.lastIndexOf('/');
    const parentName:string = opts.name.substr(0, lastIndex)
    if(lastIndex > -1){
        path = path + '/' + dasherize(parentName);
        opts.name = opts.name.substr(lastIndex + 1);
    }
    opts.effects.forEach((element: string, index: number) => opts.effects[index] = classify(element));
    const options: ExtendedSchemaOptions = {
        name: classify(opts.name),
        parentName: classify(parentName),
        effects: opts.effects
    } 
    
    return chain([
       
        externalSchematic('@ngrx/schematics', 'effect', {
            flat: false,
            group: false,
            name: options.name,
            path: path,
            spec: false
        }),
        (tree: Tree, _context: SchematicContext) => {
            const filePath = `${path}/${dasherize(options.name)}/${dasherize(options.name)}.effects.ts`;
            let sourceFile = getSourceFile(filePath, tree);
            if(!sourceFile) throw new SchematicsException(`Could not find file under filepath: ${filePath}`);
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
    
    injectionChanges.push(getImportChanges(sourceFile, options));

    injectionChanges.push(...getEffectChanges(sourceFile, options));

    return injectionChanges;
}

function getImportChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange{
    const importDeclarationNode = findNode(sourceFile, ts.SyntaxKind.ImportDeclaration, 'Actions');
    if(!importDeclarationNode) throw new SchematicsException('expected to find Actions import');
    const startIndex = importDeclarationNode.end;
    
    const name = (options.parentName) ? `${options.parentName}${options.name}` : options.name; 
    const insertText = 
        `\nimport { Action } from '@ngrx/store';` +
        `\nimport { Observable } from 'rxjs/Observable';` +
        `\nimport { map } from 'rxjs/operators';` +
        `\n` +
        `\nimport * as from${name}Actions from './${dasherize(options.name)}.actions';`
    return {startIndex, insertText}
    
}

function getEffectChanges(sourceFile: ts.Node, options: ExtendedSchemaOptions): InsertChange[] {
    const changes: InsertChange[] = [];

    //Find default Class
    const classNode = findNode(sourceFile, ts.SyntaxKind.ClassDeclaration, 'export class');
    if(!classNode) throw new SchematicsException('expected to find a class');;

    if(options.parentName){
        const identifierNode = findNode(classNode, ts.SyntaxKind.Identifier, `${options.name}Effects`)
        if(identifierNode) changes.push({startIndex: identifierNode.getStart(), insertText: options.parentName})
    }

    const firstPunctuationNode = findNode(classNode, ts.SyntaxKind.FirstPunctuation, '{');
    if(!firstPunctuationNode) throw new SchematicsException('expected class to have an opening bracket');;
    const startIndex = firstPunctuationNode.end;
    
    if(options.effects){ 
        const name = (options.parentName) ? `${options.parentName}${options.name}` : options.name; 
        options.effects.forEach((effect: string) => {
            const insertText = 
            '\n// Check if suggested return actions are correct(should be 90% of times)\n' +

            `\n  @Effect() public ${effect}$: Observable<Action> = this.actions$` +
            `\n  .ofType(from${name}Actions.${name}ActionTypes.${effect})` +
            `\n  .pipe(` + 
            `${getEffectSpecificText(effect, name)}` +
            `\n  );`;
            changes.push({startIndex, insertText});
        });
    }
    return changes;
}

function getEffectSpecificText(effect: string, name: string): string{
    
    if(effect.includes('Completed' || 'Fail')){
        const untilIndex = effect.includes('Completed') ? effect.indexOf('Completed'): effect.indexOf('Fail') ;
        const lengthOfKeyWord = 4; //'Load' or 'Save' 
        let baseEffectName: string = '';
        baseEffectName = effect.substr(lengthOfKeyWord, untilIndex - lengthOfKeyWord);
        
        return `\n    map((action: from${name}Actions.${effect}) => {` +
            `\n      // create input for UpdateAction` +
            `\n      return new from${name}Actions.Update${baseEffectName}(/* input */);` +
            `\n    })`;
    }else if(effect.includes('Load' || effect.includes('Send'))){
        return `\n    replaceThisMap/* switchMap or mergeMap */((action: from${name}Actions.${effect}) => {` +
        `\n      return someApi.getData()` +
        `\n        .pipe(` +
        `\n          map((${name} /*: {Add Typing} */) => {` +
        `\n            // create input for completedAction` +
        `\n            return new from${name}Actions.${effect}Completed(/* input */);` +
        `\n          }),` +
        `\n          catchError((error) => {` +
        `\n            // create input for errorAction` +
        `\n            return new from${name}Actions.${effect}Fail(/* input */);` +
        `\n          })` +
        `\n      );` +
        `\n    })`;
    }else if(effect.includes('Create')){
        const baseEffectName = effect.substr('Create'.length);
        return `\n    map((action: from${name}Actions.${effect}) => {` +
            `\n      // create input for SaveAction` +
            `\n      return new from${name}Actions.Save${baseEffectName}(/* input */);` + 
            `\n    })`;
    }
    return `// Unrecognized effect type: known types are Create.. | Load.. | Load..Fail | Load..Completed | Send.. | Send..Fail | Send..Completed`;
}
