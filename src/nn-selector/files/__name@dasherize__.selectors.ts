import { createFeatureSelector } from '@ngrx/store';
import { <%= concatName %>State } from './<%= dasherize(name) %>.reducer';

// Selector for selecting the "customer" slice from the state
export const get<%= concatName %>State = createFeatureSelector<<%= concatName %>State>(
  '<%= camelize(concatName) %>'
);
