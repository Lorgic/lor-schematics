#!/usr/bin/env node
const { execSync } = require('child_process');

const argv = process.argv;
let name = '';
let reducers = '';
let effects = ''

argv.forEach((arg) => {
    if(arg.indexOf('--name') > -1){
        name = arg.substring('--name'.length + 1);
    }else if(arg.indexOf('--reducers') > -1){
        reducers = arg.substring('--reducers'.length + 1);
    }else if(arg.indexOf('--effects') > -1){
        effects = arg.substring('--effects'.length + 1);
    } 
});

if(!name || !reducers && !effects){
    return console.log('--name and --reducers and/or --effects are required parameters');
}
const actions = [];
if(effects){ 
    effects = JSON.parse(effects);
    if(!Array.isArray(effects)) throw new SchematicsException('Expected effects to parse to an array');
    actions.push(...effects);
}; 
if(reducers){ 
    reducers = JSON.parse(reducers);
    if(!Array.isArray(reducers)) throw new SchematicsException('Expected reducers to parse to an array');
    actions.push(...reducers);
};
console.log(name, reducers, effects, actions);
execSync(`ng g @nn/schematics:nn-ngrx-state --name=${name}`);
execSync(`ng g @nn/schematics:nn-ngrx-action --name=${name} --actions=${actions}`);
if(effects){
    execSync(`ng g @nn/schematics:nn-ngrx-effect --name=${name} --effects=${effects}`);
}
if(reducers){
    execSync(`ng g @nn/schematics:nn-ngrx-reducer --name=${name} --reducers=${reducers}`);
}
execSync(`ng g @nn/schematics:nn-ngrx-selector --name=${name}`);

