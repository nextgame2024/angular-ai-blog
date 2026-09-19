import {CommonModule} from '@angular/common';
import {Component,EventEmitter,Input,Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import type {ConsultationView} from './student-consultation';
@Component({selector:'app-student-consultation-panel',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./student-consultation-panel.component.html',styleUrls:['./student-consultation-panel.component.css']})
export class StudentConsultationPanelComponent {
  @Input({required:true}) view!:ConsultationView;
  @Output() closeView=new EventEmitter<void>();
  @Output() edit=new EventEmitter<{field:'customerName'|'customerEmail'|'includeSummary'|'enquirySummary';value:string|boolean}>();
  emailLabel(status:string):string {
    return ({sent:'Confirmation email accepted by the email provider.',logged:'Demo email recorded only; no email was delivered.',failed:'Booking saved. Email delivery failed; ask Sophia to retry.',queued:'Confirmation email queued.',sending:'Confirmation email is being sent.',retry:'Email delivery is pending a retry.'} as Record<string,string>)[status]||'Email delivery has not been confirmed.';
  }
}
