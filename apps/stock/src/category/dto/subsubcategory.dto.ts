import { IsString } from 'class-validator';
import {
  BaseCategoryCreateDto,
  BaseCategoryUpdateDto,
  BaseCategoryGetDto,
} from './base-category.dto';

export class CreateSubSubCategoryDto extends BaseCategoryCreateDto {
  @IsString()
  subCategoryId: string;
}

export class UpdateSubSubCategoryDto extends BaseCategoryUpdateDto {}

export class GetSubSubCategoriesDto extends BaseCategoryGetDto {
  @IsString()
  subCategoryId: string;
}
