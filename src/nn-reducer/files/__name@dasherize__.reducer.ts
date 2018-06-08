import { Action } from '@ngrx/store';
import * as from<%= concatName %>Actions from './<%= dasherize(name) %>.actions';

export interface <%= concatName %>State {

}

export const initialState: <%= concatName %>State = {

};

export function reducer(
  state: <%= concatName %>State = initialState,
  action: from<%= concatName %>Actions.<%= concatName %>Actions
): <%= concatName %>State {
  switch (action.type) {

    default:
      return state;
  }
}
