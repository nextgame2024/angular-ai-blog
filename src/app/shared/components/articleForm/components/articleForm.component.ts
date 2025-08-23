import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ArticleFormValuesInterface } from '../types/articleFormValues.interface';
import { BackendErrorMessages } from '../../backendErrorMessages.component';
import { BackendErrorsInterface } from 'src/app/shared/types/backendErrors.interface';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'mc-article-form',
  templateUrl: './articleForm.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, BackendErrorMessages, CommonModule],
})
export class ArticleFormComponent implements OnInit {
  @Input() initialValues?: ArticleFormValuesInterface;
  @Input() isSubmitting: boolean = false;
  @Input() errors: BackendErrorsInterface | null = null;

  @Output() articleSubmit = new EventEmitter<ArticleFormValuesInterface>();

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    body: ['', Validators.required],
    tagList: [''],
  });

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm(): void {
    if (!this.initialValues) {
      throw new Error('Inputs are not provided');
    }

    this.form.patchValue({
      title: this.initialValues.title,
      description: this.initialValues.description,
      body: this.initialValues.body,
      tagList: this.initialValues.tagList.join(' '),
    });
  }

  onSubmit(): void {
    const formValue = this.form.getRawValue();
    const articleFormValues: ArticleFormValuesInterface = {
      ...formValue,
      tagList: String(formValue.tagList || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    };
    this.articleSubmit.emit(articleFormValues);
  }
}
