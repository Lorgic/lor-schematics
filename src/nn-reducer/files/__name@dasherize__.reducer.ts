import { Action } from '@ngrx/store';
import * as from<%= classify(parentName) %><%= classify(name) %>Actions from './<%= dasherize(name) %>.actions';

export interface <%= classify(parentName) %><%= classify(name) %>State {

}

export const initialState: <%= classify(parentName) %><%= classify(name) %>State = {

};

export function reducer(
  state: <%= classify(parentName) %><%= classify(name) %>State = initialState, 
  action: from<%= classify(parentName) %><%= classify(name) %>Actions.<%= classify(parentName) %><%= classify(name) %>Actions
): <%= classify(parentName) %><%= classify(name) %>State {
  switch (action.type) {

    default:
      return state;
  }
}
