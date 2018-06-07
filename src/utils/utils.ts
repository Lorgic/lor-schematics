import * as ts from 'typescript';
import { Tree } from '@angular-devkit/schematics/src/tree/interface';
import { classify, dasherize } from '@angular-devkit/core/src/utils/strings';

export function findNode(node: ts.Node, kind: ts.SyntaxKind, text: string): ts.Node | null {
    if (node.kind === kind 
      && node.getText().indexOf(text) > -1 
      ) {
      return node;
    }
    let childNode = null;
    node.getChildren().some((child) => {
        let node = findNode(child, kind, text);
        if(node) {
            childNode = node;
            return true; 
        };
        return false;
    });
    return childNode;
}
export function showTree(node: ts.Node, indent: string = '    '): void {
    console.log(indent + ts.SyntaxKind[node.kind]);
    if (node.getChildCount() === 0) {
        console.log(indent + '    Text: ' + node.getText());
    }

    for(let child of node.getChildren()) {
        showTree(child, indent + '    ');
    }
}

export function getSourceFile(filePath: string, tree: Tree): ts.SourceFile | null {
    const file = tree.read(filePath);
    const content = (file)? file.toString('utf-8') : null;
    if(content) return ts.createSourceFile('demo.ts', content, ts.ScriptTarget.Latest, true)
    else return null;

}
export interface IDecomposedName{
    source: string;
    name: string;
    parentName: string;
    concatName: string,
    ancestors: string;
    path: string;
}
export function decomposeName(name: string): IDecomposedName{
    let result: IDecomposedName = {
        source: classify(name),
        name: '',
        parentName: '',
        concatName: '',
        ancestors: '',
        path: 'src/state'
    };
    const splits: string[] = name.split('/');
    if(splits.length > 2) {
        let ancestors = '';
        splits.forEach((value: string, index: number) => {
            if(index < splits.length - 3){
                ancestors += (index = 0) ? value : '/' + value;
                result.path += '/' + dasherize(value);
            }
        })
        result.ancestors = classify(ancestors);
        
    }
    if(splits.length = 2 || splits.length > 2){
        result.parentName = classify(splits[splits.length -2]);
        result.path += '/' + dasherize(splits[splits.length -2]);
    }
    result.name = classify(splits[splits.length -1]);
    result.path += '/' + dasherize(splits[splits.length -1]);
    result.concatName = result.parentName + result.name;
    

    return result;
}
export interface InsertChange {
    startIndex: number, 
    insertText: string
}

export interface RemoveChange {
    startIndex: number, 
    length: number
}