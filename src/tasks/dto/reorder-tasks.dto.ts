import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class ReorderTasksDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  taskIds: number[];
}
