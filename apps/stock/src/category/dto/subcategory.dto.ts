import { IsString } from 'class-validator';
import {
  BaseCategoryCreateDto,
  BaseCategoryUpdateDto,
  BaseCategoryGetDto,
} from './base-category.dto';

export class CreateSubCategoryDto extends BaseCategoryCreateDto {
  @IsString()
  categoryId: string;
}

export class UpdateSubCategoryDto extends BaseCategoryUpdateDto {}

export class GetSubCategoriesDto extends BaseCategoryGetDto {
  @IsString()
  categoryId: string;
}
