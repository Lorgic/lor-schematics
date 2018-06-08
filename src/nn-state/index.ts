import { IDecomposedName } from './../utils/utils';
import { Rule, chain, SchematicsException, schematic, Tree, SchematicContext, apply, url, template, mergeWith, move, filter } from '@angular-devkit/schematics';
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
                return mergeWith(apply(url('./files'), [
                    filter(path => !!path.match(/index\.ts$/)),
                    move(filePath)
                ]))(tree, _context);
            }
        },
        schematic('nn-ngrx-action', {
            name: opts.name,
            actions: JSON.stringify(actions),
        }),
         (tree: Tree, _context: SchematicContext) => {
            if(opts.effects) return schematic('nn-ngrx-effect', {
                name: opts.name,
                effects: JSON.stringify(opts.effects),
            })(tree, _context)
        },
        (tree: Tree, _context: SchematicContext) => {
            if(opts.reducers) return schematic('nn-ngrx-reducer', {
                name: opts.name,
                reducers: JSON.stringify(opts.reducers),
            })(tree, _context)
        },
       
        schematic('nn-ngrx-selector', {
            name: opts.name
        }),
    ]);
}
