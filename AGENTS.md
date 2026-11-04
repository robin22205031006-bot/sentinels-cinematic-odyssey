<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Entity pictures are stored as resized data URLs in `entities.image_url` — workspace blocks public storage buckets.
- PDF ingestion: text is extracted in the browser, AI output is filtered by `src/lib/lore-merge.ts` (verbatim-quote grounding) and admin-edited fields go into `locked_fields`, which ingestion never overwrites.
