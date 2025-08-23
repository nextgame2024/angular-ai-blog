import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { combineLatest, filter, map, Observable } from 'rxjs';
import { ArticleFormComponent } from 'src/app/shared/components/articleForm/components/articleForm.component';
import { ArticleFormValuesInterface } from 'src/app/shared/components/articleForm/types/articleFormValues.interface';
import {
  selectIsSubmitting,
  selectValidationErrors,
  selectIsLoading,
  selectArticle,
} from '../store/reducers';
import { ArticleRequestInterface } from 'src/app/shared/types/articleRequest.interface';
import { editArticleActions } from '../store/actions';
import { LoadingComponent } from 'src/app/shared/components/loading/loading.component';
import { ActivatedRoute } from '@angular/router';
import { ArticleInterface } from 'src/app/shared/types/article.interface';

@Component({
  selector: 'mc-edit-create',
  templateUrl: './editArticle.component.html',
  standalone: true,
  imports: [CommonModule, ArticleFormComponent, LoadingComponent],
})
export class EditArticleComponent implements OnInit {
  initialValues$: Observable<ArticleFormValuesInterface> = this.store.pipe(
    select(selectArticle),
    filter((article): article is ArticleInterface => article !== null),
    map((article: ArticleInterface) => {
      return {
        title: article.title,
        description: article.description,
        body: article.body,
        tagList: article.tagList,
      };
    })
  );

  slug = this.route.snapshot.paramMap.get('slug') ?? '';

  data$ = combineLatest({
    isSubmitting: this.store.select(selectIsSubmitting),
    backendErrors: this.store.select(selectValidationErrors),
    isLoading: this.store.select(selectIsLoading),
    initialValues: this.initialValues$,
  });
  constructor(private store: Store, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.store.dispatch(editArticleActions.getArticle({ slug: this.slug }));
  }

  onSubmit(articleFormValues: ArticleFormValuesInterface): void {
    const request: ArticleRequestInterface = {
      article: articleFormValues,
    };
    this.store.dispatch(
      editArticleActions.updateArticle({ request, slug: this.slug })
    );
  }
}
