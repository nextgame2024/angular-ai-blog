import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  BmProject,
  BmProjectLabor,
  BmProjectMaterial,
  PagedResult,
} from '../../types/projects.interface';
import { ProjectFormTab } from './manager.state';

export const ManagerProjectsActions = createActionGroup({
  source: 'Manager Projects',
  events: {
    'Set Projects Search Query': props<{ query: string }>(),

    'Load Projects': props<{ page: number }>(),
    'Load Projects Success': props<{ result: PagedResult<BmProject> }>(),
    'Load Projects Failure': props<{ error: string }>(),

    'Open Project Create': emptyProps(),
    'Open Project Edit': props<{ projectId: string }>(),
    'Close Project Form': emptyProps(),

    'Set Project Form Tab': props<{ tab: ProjectFormTab }>(),

    'Save Project': props<{ payload: any; closeOnSuccess?: boolean }>(),
    'Save Project Success': props<{ project: BmProject; closeOnSuccess?: boolean }>(),
    'Save Project Failure': props<{ error: string }>(),

    'Remove Project': props<{ projectId: string }>(),
    'Remove Project Success': props<{ projectId: string; action: 'archived' | 'deleted' }>(),
    'Remove Project Failure': props<{ error: string }>(),

    // Materials
    'Load Project Materials': props<{ projectId: string }>(),
    'Load Project Materials Success': props<{ materials: BmProjectMaterial[] }>(),
    'Load Project Materials Failure': props<{ error: string }>(),

    'Open Project Material Create': emptyProps(),
    'Open Project Material Edit': props<{ materialId: string }>(),
    'Close Project Material Form': emptyProps(),

    'Save Project Material': props<{
      projectId: string;
      materialId?: string | null;
      payload: any;
    }>(),
    'Save Project Material Success': props<{ projectMaterial: BmProjectMaterial }>(),
    'Save Project Material Failure': props<{ error: string }>(),

    'Remove Project Material': props<{ projectId: string; materialId: string }>(),
    'Remove Project Material Success': props<{ materialId: string }>(),
    'Remove Project Material Failure': props<{ error: string }>(),

    // Labor
    'Load Project Labor': props<{ projectId: string }>(),
    'Load Project Labor Success': props<{ labor: BmProjectLabor[] }>(),
    'Load Project Labor Failure': props<{ error: string }>(),

    'Open Project Labor Create': emptyProps(),
    'Open Project Labor Edit': props<{ laborId: string }>(),
    'Close Project Labor Form': emptyProps(),

    'Save Project Labor': props<{
      projectId: string;
      laborId?: string | null;
      payload: any;
    }>(),
    'Save Project Labor Success': props<{ projectLabor: BmProjectLabor }>(),
    'Save Project Labor Failure': props<{ error: string }>(),

    'Remove Project Labor': props<{ projectId: string; laborId: string }>(),
    'Remove Project Labor Success': props<{ laborId: string }>(),
    'Remove Project Labor Failure': props<{ error: string }>(),
  },
});
