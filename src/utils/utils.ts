import * as ts from 'typescript';
import { Tree } from '@angular-devkit/schematics/src/tree/interface';

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
export interface InsertChange {
    startIndex: number, 
    insertText: string
}

export interface RemoveChange {
    startIndex: number, 
    length: number
}