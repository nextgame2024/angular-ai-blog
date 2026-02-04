import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  BmProjectType,
  BmProjectTypeLabor,
  BmProjectTypeMaterial,
  PagedResult,
} from '../../types/project.types.interface';
import { ProjectTypeFormTab } from './manager.state';

export const ManagerProjectTypesActions = createActionGroup({
  source: 'Manager Project Types',
  events: {
    'Set Project Types Search Query': props<{ query: string }>(),

    'Load Project Types': props<{ page: number }>(),
    'Load Project Types Success': props<{
      result: PagedResult<BmProjectType>;
    }>(),
    'Load Project Types Failure': props<{ error: string }>(),

    'Open Project Type Create': emptyProps(),
    'Open Project Type Edit': props<{ projectTypeId: string }>(),
    'Close Project Type Form': emptyProps(),

    'Set Project Type Form Tab': props<{ tab: ProjectTypeFormTab }>(),

    'Save Project Type': props<{ payload: any; closeOnSuccess?: boolean }>(),
    'Save Project Type Success': props<{
      projectType: BmProjectType;
      closeOnSuccess?: boolean;
    }>(),
    'Save Project Type Failure': props<{ error: string }>(),

    'Archive Project Type': props<{ projectTypeId: string }>(),
    'Archive Project Type Success': props<{ projectTypeId: string }>(),
    'Archive Project Type Failure': props<{ error: string }>(),

    // Materials
    'Load Project Type Materials': props<{ projectTypeId: string }>(),
    'Load Project Type Materials Success': props<{
      materials: BmProjectTypeMaterial[];
    }>(),
    'Load Project Type Materials Failure': props<{ error: string }>(),

    'Open Project Type Material Create': emptyProps(),
    'Open Project Type Material Edit': props<{ materialId: string }>(),
    'Close Project Type Material Form': emptyProps(),

    'Save Project Type Material': props<{
      projectTypeId: string;
      materialId?: string | null;
      payload: any;
    }>(),
    'Save Project Type Material Success': props<{
      projectTypeMaterial: BmProjectTypeMaterial;
    }>(),
    'Save Project Type Material Failure': props<{ error: string }>(),

    'Remove Project Type Material': props<{
      projectTypeId: string;
      materialId: string;
    }>(),
    'Remove Project Type Material Success': props<{ materialId: string }>(),
    'Remove Project Type Material Failure': props<{ error: string }>(),

    // Labor
    'Load Project Type Labor': props<{ projectTypeId: string }>(),
    'Load Project Type Labor Success': props<{
      labor: BmProjectTypeLabor[];
    }>(),
    'Load Project Type Labor Failure': props<{ error: string }>(),

    'Open Project Type Labor Create': emptyProps(),
    'Open Project Type Labor Edit': props<{ laborId: string }>(),
    'Close Project Type Labor Form': emptyProps(),

    'Save Project Type Labor': props<{
      projectTypeId: string;
      laborId?: string | null;
      payload: any;
    }>(),
    'Save Project Type Labor Success': props<{
      projectTypeLabor: BmProjectTypeLabor;
    }>(),
    'Save Project Type Labor Failure': props<{ error: string }>(),

    'Remove Project Type Labor': props<{
      projectTypeId: string;
      laborId: string;
    }>(),
    'Remove Project Type Labor Success': props<{ laborId: string }>(),
    'Remove Project Type Labor Failure': props<{ error: string }>(),
  },
});
