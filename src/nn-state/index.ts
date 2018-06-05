import { Rule, chain, SchematicsException, schematic } from '@angular-devkit/schematics';
import { SchemaOptions } from './schema';

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
        schematic('nn-ngrx-action', {
            name: opts.name,
            actions: JSON.stringify(actions),
        }),
    ]);
}