ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'expense';

UPDATE public.categories SET kind = 'income' WHERE parent_id IS NULL AND name IN ('Salary','Freelance','Investment Income','Bonus','Gift');
UPDATE public.categories SET kind = 'both' WHERE parent_id IS NULL AND name IN ('Transfer','Other');
UPDATE public.categories c SET kind = p.kind FROM public.categories p WHERE c.parent_id = p.id;