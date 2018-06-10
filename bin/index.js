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
let actions = [];
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
actions = JSON.stringify(actions).replace("[", "['").replace("]", "']");
console.log('Executing lor-ngrx-state schematic');
execSync(`ng g @lor/schematics:lor-ngrx-state --name=${name}`,{stdio:[0,1,2]});

console.log('Executing lor-ngrx-action schematic');
execSync(`ng g @lor/schematics:lor-ngrx-action --name=${name} --actions=${actions}`, {stdio:[0,1,2]});

if(effects){
    effects = JSON.stringify(effects).replace("[", "['").replace("]", "']");
    console.log('Executing lor-ngrx-effect schematic');
    execSync(`ng g @lor/schematics:lor-ngrx-effect --name=${name} --effects=${effects}`, {stdio:[0,1,2]});
}

if(reducers){
    reducers = JSON.stringify(reducers).replace("[", "['").replace("]", "']");
    console.log('Executing lor-ngrx-reducer schematic');
    execSync(`ng g @lor/schematics:lor-ngrx-reducer --name=${name} --reducers=${reducers}`, {stdio:[0,1,2]});
}

console.log('Executing lor-ngrx-selector schematic');
execSync(`ng g @lor/schematics:lor-ngrx-selector --name=${name}`, {stdio:[0,1,2]});
console.log('End of schematic');
