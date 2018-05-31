import { Component } from '@angular/core';

@Component({
    selector: 'my-first-schema-component',
    templateUrl: './my-first-schema.component.ts',
    styleUrls: [ './my-first-schema.component.css']
})

export class MyFirstSchemaComponent {
    constructor(){
        console.log( '<%= classify(name) %>');
    }
}
