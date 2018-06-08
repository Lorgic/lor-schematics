import { Rule, chain, Tree, SchematicContext, externalSchematic, SchematicsException, mergeWith, apply, url, filter, template, move,  } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';
import * as ts from 'typescript';
import { dasherize, classify } from '@angular-devkit/core/src/utils/strings';
import { getSourceFile, InsertChange, findNode, decomposeName } from '../utils/utils';
import { strings } from '@angular-devkit/core';

interface ExtendedSchemaOptions extends SchemaOptions{
    concatName: string;
    path: string;
}

export default function (opts: SchemaOptions): Rule {
    const decName = decomposeName(opts.name);
    
    const options: ExtendedSchemaOptions = {
        path: decName.path,
        name: decName.name,
        concatName: decName.concatName
    } 
    
    return chain([
        (tree: Tree, _context: SchematicContext) => {
            return mergeWith(apply(url('./files'), [
                filter(path => !!path.match(/selectors\.ts$/)),
                template({
                    ...strings,
                    name: options.name,
                    concatName: options.concatName
                  }),
                move(options.path)
            ]))(tree, _context);
        },
    ]);
}
