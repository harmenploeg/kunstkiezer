import type { CatalogItem } from "../../../../../packages/data/src/catalog.ts";
import { safeWebUrl } from "../../../../../packages/data/src/museums.ts";
import {
  detailHref,
  subjectKind,
  tagHref,
  visitorText,
} from "../../../../../packages/domain/src/presentation.ts";
import { CatalogActions } from "../visits/Visits.tsx";
import { TasteMatches } from "../profile/Personalization.tsx";
export function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="tag-list">
      {tags.map((t) => (
        <a
          href={tagHref(t)}
          key={t}
          className={t.startsWith("maker: ") ? "creator-tag" : undefined}
        >
          {t.replace(/^maker: /, "")}
        </a>
      ))}
    </div>
  );
}
export function Kind({ item }: { item: CatalogItem }) {
  return (
    <span className={"subject-kind kind-" + item.category}>
      {subjectKind(item)}
    </span>
  );
}
export function Photos({ item }: { item: CatalogItem }) {
  return (
    <div className="museum-photos">
      {(item.photos ?? [])
        .filter((p) => safeWebUrl(p.url))
        .map((p, i) => (
          <figure key={i}>
            <img src={p.url} alt={p.caption || item.name} loading="lazy" />
            <figcaption>
              {p.caption}
              {p.credit && ` · ${p.credit}`}{" "}
              {safeWebUrl(p.source_url) && (
                <a
                  href={p.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {p.license || "Bron"}
                </a>
              )}
            </figcaption>
          </figure>
        ))}
    </div>
  );
}
export function CatalogCard({
  item,
  preferences = [],
}: {
  item: CatalogItem;
  preferences?: string[];
}) {
  return (
    <article className="museum-card">
      <Kind item={item} />
      <p className="eyebrow">
        {[item.city, item.province].filter(Boolean).join(" · ")}
      </p>
      <h2>
        <a href={detailHref(item)}>{item.name}</a>
      </h2>
      <TasteMatches tags={item.tags} preferences={preferences} />
      {item.operating_status === "temporarily_closed" && (
        <p>Tijdelijk gesloten</p>
      )}
      {item.creator && <p>{item.creator}</p>}
      {"starts_on" in item && item.starts_on && item.ends_on && (
        <p>
          <time dateTime={item.starts_on}>
            {item.starts_on.split("-").reverse().join("-")}
          </time>{" "}
          t/m{" "}
          <time dateTime={item.ends_on}>
            {item.ends_on.split("-").reverse().join("-")}
          </time>
        </p>
      )}
      <Photos item={item} />
      <p>{visitorText(item.summary)}</p>
      <p>{[item.street_address, item.city].filter(Boolean).join(", ")}</p>
      {"visit_notes" in item && visitorText(item.visit_notes) && (
        <p>{visitorText(item.visit_notes)}</p>
      )}
      <Tags tags={item.tags} />
      <a className="text-button" href={detailHref(item)}>
        Bekijk en plan je bezoek →
      </a>
      <CatalogActions id={item.id} category={item.category} name={item.name} />
    </article>
  );
}
