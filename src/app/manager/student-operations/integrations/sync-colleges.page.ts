import {Component,OnDestroy,OnInit,inject} from '@angular/core';
import {FormControl,ReactiveFormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Subject,takeUntil} from 'rxjs';
import {StudentOperationsService} from '../student-operations.service';
import {CollegeMatchingComponent} from './college-matching.component';
import {ManagerSelectComponent} from '../../components/shared/manager-select/manager-select.component';
import {ManagerListLoaderComponent} from '../../components/shared/manager-list-loader/manager-list-loader.component';
import {ManagerToastComponent} from '../../components/shared/manager-toast/manager-toast.component';

@Component({selector:'app-sync-colleges',imports:[RouterLink,ReactiveFormsModule,CollegeMatchingComponent,ManagerSelectComponent,ManagerListLoaderComponent,ManagerToastComponent],
  templateUrl:'./sync-colleges.page.html',styleUrls:['./sync-colleges.page.css']})
export class SyncCollegesPageComponent implements OnInit,OnDestroy {
  private readonly api=inject(StudentOperationsService);
  private readonly stop$=new Subject<void>();
  readonly connection=new FormControl('',{nonNullable:true});
  options:Array<{value:string;label:string}>=[];
  loading=true;error='';
  ngOnInit(){this.load();}
  ngOnDestroy(){this.stop$.next();this.stop$.complete();}
  load(){this.stop$.next();this.loading=true;this.error='';
    this.api.xeroStatus().pipe(takeUntil(this.stop$)).subscribe({next:data=>{
      this.options=data.connections.filter(c=>c.status==='active'&&c.organisationRole==='operating').map(c=>({value:c.connectionId,label:c.tenantName}));
      if(!this.options.some(c=>c.value===this.connection.value))this.connection.setValue(this.options.length===1?this.options[0].value:'');
      this.loading=false;
    },error:()=>{this.loading=false;this.error='College sync is available to Chief Executives in the student operations workspace. Check your access or retry.';}});
  }
}
