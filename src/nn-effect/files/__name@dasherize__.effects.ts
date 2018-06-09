import { Injectable } from '@angular/core';
import { Actions, Effect } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { map, catchError } from 'rxjs/operators';
import * as from<%= concatName %>Actions from './<%= dasherize(name) %>.actions';

@Injectable()
export class <%= concatName %>Effects {

  constructor(private actions$: Actions) {}
}

