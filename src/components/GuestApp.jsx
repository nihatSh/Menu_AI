"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  User,
  Sun,
  Moon,
  Thermometer,
  Clock,
  EyeSlash,
  MagnifyingGlass,
  X,
  FirstAid,
  CheckCircle,
} from "@phosphor-icons/react";

import { hardFilter, localized, scoreDishes, cartTotals, partOfDayFor } from "@/lib/menu";
import { t, LANGS } from "@/lib/i18n";
import {
  loadProfile,
  saveProfile,
  addEatenToProfile,
  rememberFavourite,
  toggleFavourite,
  rememberVisit,
} from "@/lib/profile";
import { accentVars, readTheme, applyTheme } from "@/lib/theme";
import { currentPhase, primaryAction, estimateWait } from "@/lib/journey";

import DishCard from "./DishCard";
import DishSheet from "./DishSheet";
import AiWaiter from "./AiWaiter";
import ProfileSheet from "./ProfileSheet";
import BasketSheet from "./BasketSheet";
import OrderTracker from "./OrderTracker";
import BottomBar from "./BottomBar";
import { Button, Badge, DishSkeleton, EmptyState, Note, cx } from "./ui";

export default function GuestApp({ restaurant, table }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const [mode, setMode] = useState("light");
  const [tab, setTab] = useState("menu");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [hunger, setHunger] = useState(3);
  const [justTrained, setJustTrained] = useState(false);
  const [openDish, setOpenDish] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showBasket, setShowBasket] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [myOrderIds, setMyOrderIds] = useState([]);
  const [orders, setOrders] = useState(null);
  const [me, setMe] = useState(null);
  const [live, setLive] = useState(null);
  const [scores, setScores] = useState({});
  const [toast, setToast] = useState(null);
  const [pendingAsk, setPendingAsk] = useState(null);
  const [dismissedAllergyPrompt, setDismissedAllergyPrompt] = useState(false);
  const [barH, setBarH] = useState(124); // replaced by the bar's measured height
  const orderKeyRef = useRef(null);
  const searchRef = useRef(null);

  const lang = profile.lang || "en";
  const strings = t(lang);

  useEffect(() => setMode(readTheme()), []);

  useEffect(() => {
    setProfile((p) => rememberVisit(p, restaurant.slug));
  }, [restaurant.slug]);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const refreshContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/context?slug=${restaurant.slug}`, { cache: "no-store" });
      if (res.ok) setLive(await res.json());
    } catch {
      setLive((l) => l ?? { weather: null, kitchen: { level: "calm", extraMinutes: 0 }, soldOut: [] });
    }
  }, [restaurant.slug]);

  // Orders are fetched here rather than inside the tracker: the bottom bar
  // needs to know the phase of the meal on every screen, not only on Orders.
  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?slug=${restaurant.slug}&table=${table}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setOrders(data.orders || []);
      setMe(data.me || null);
    } catch {
      setOrders((o) => o ?? []);
    }
  }, [restaurant.slug, table]);

  useEffect(() => {
    refreshContext();
    refreshOrders();
    const ctx = setInterval(refreshContext, 30000);
    const ord = setInterval(refreshOrders, 5000);
    return () => {
      clearInterval(ctx);
      clearInterval(ord);
    };
  }, [refreshContext, refreshOrders]);

  useEffect(() => {
    fetch(`/api/feedback?slug=${restaurant.slug}`)
      .then((r) => r.json())
      .then((d) => setScores(d.scores || {}))
      .catch(() => {});
  }, [restaurant.slug]);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const soldOut = live?.soldOut || [];
  const weather = live?.weather || null;
  const kitchen = live?.kitchen || { level: "calm", extraMinutes: 0 };
  const extraMinutes = kitchen.extraMinutes || 0;

  const { safe, removed } = useMemo(
    () => hardFilter(restaurant.menu, profile, soldOut),
    [restaurant.menu, profile, soldOut]
  );

  const categories = useMemo(() => ["all", ...new Set(safe.map((d) => d.category))], [safe]);

  const ranker = useMemo(
    () => ({ hunger, weather, partOfDay: partOfDayFor(new Date()), kitchen, justTrained }),
    [hunger, weather, kitchen, justTrained]
  );

  const q = query.trim().toLowerCase();

  const matching = useMemo(() => {
    if (!q) return safe;
    return safe.filter((d) =>
      [localized(d.name, lang), localized(d.desc, lang), d.category, ...(d.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [safe, q, lang]);

  /**
   * Browsing the whole menu is grouped into its real sections with sticky
   * headers, because that is how a menu is read and it tells you where you are
   * in a long scroll. Filtering or searching flattens to one ranked list, since
   * the guest has already narrowed it and only wants the best match first.
   * Either way dishes are ordered by the same signals the AI uses.
   */
  const sections = useMemo(() => {
    const rank = (list) => scoreDishes(list, ranker).map((x) => x.dish);

    if (q || category !== "all") {
      const list = category === "all" ? matching : matching.filter((d) => d.category === category);
      return [{ key: "flat", title: null, dishes: rank(list) }];
    }

    const order = [...new Set(safe.map((d) => d.category))];
    return order
      .map((c) => ({ key: c, title: c, dishes: rank(safe.filter((d) => d.category === c)) }))
      .filter((s) => s.dishes.length > 0);
  }, [q, category, matching, safe, ranker]);

  const visibleCount = sections.reduce((n, s) => n + s.dishes.length, 0);
  const totals = cartTotals(cart);

  const myOrders = useMemo(
    () => (orders || []).filter((o) => (me && o.guestId === me) || myOrderIds.includes(o.id)),
    [orders, me, myOrderIds]
  );

  const phase = currentPhase({ cartCount: totals.count, myOrders });
  const suggested = primaryAction({
    phase,
    cartCount: totals.count,
    cartTotal: totals.price,
    currency: restaurant.currency,
    myOrders,
    strings,
  });
  // Never offer to take someone where they already are. "Track your order"
  // on the Orders screen is noise, and it crowded the confirmation that
  // appears the moment an order is sent.
  const action = suggested && suggested.to === tab ? null : suggested;

  // Asked once, on the first visit only, and dismissible. The most important
  // safety input used to be hidden behind a person icon in the corner, where a
  // first-time guest would never find it.
  const showAllergyPrompt =
    !dismissedAllergyPrompt &&
    profile.allergens.length === 0 &&
    profile.diets.length === 0 &&
    profile.visited.length <= 1;

  function toggleMode() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyTheme(next);
  }

  function flash(message, tone = "neutral") {
    setToast({ message, tone });
    setTimeout(() => setToast(null), tone === "good" ? 2600 : 1700);
  }

  function addToCart(dish) {
    setCart((c) => {
      const found = c.find((i) => i.dishId === dish.id);
      if (found) return c.map((i) => (i.dishId === dish.id ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...c,
        {
          dishId: dish.id,
          name: localized(dish.name, lang) || dish.name,
          emoji: dish.emoji,
          price: dish.price,
          kcal: dish.kcal,
          protein: dish.protein,
          prepMinutes: dish.prepMinutes,
          qty: 1,
          serveInMinutes: 0,
        },
      ];
    });
    // No toast here on purpose: the card's control becomes a stepper showing
    // the count and the bottom bar appears with the running total. A third
    // confirmation would be noise, and it overlapped the action button.
  }

  function setQty(dishId, qty) {
    if (qty <= 0) {
      setCart((c) => c.filter((i) => i.dishId !== dishId));
      return;
    }
    setCart((c) => {
      const found = c.find((i) => i.dishId === dishId);
      if (found) return c.map((i) => (i.dishId === dishId ? { ...i, qty } : i));
      const dish = restaurant.menu.find((d) => d.id === dishId);
      return dish ? [...c, {
        dishId: dish.id,
        name: localized(dish.name, lang),
        emoji: dish.emoji,
        price: dish.price,
        kcal: dish.kcal,
        protein: dish.protein,
        prepMinutes: dish.prepMinutes,
        qty,
        serveInMinutes: 0,
      }] : c;
    });
  }

  function favourite(dishId) {
    setProfile((p) => toggleFavourite(p, dishId));
  }

  function askAbout(dish) {
    setOpenDish(null);
    setPendingAsk(strings.whatIsDish.replace("{dish}", localized(dish.name, lang)));
    setTab("ai");
  }

  async function sendOrder({ name, note }) {
    setSending(true);
    setOrderError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: restaurant.slug,
          table,
          guestName: name,
          note,
          idempotencyKey: (orderKeyRef.current ||= crypto.randomUUID()),
          allergens: profile.allergens,
          items: cart.map((i) => ({
            dishId: i.dishId,
            qty: i.qty,
            serveInMinutes: i.serveInMinutes,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || strings.orderFailed);
        return;
      }

      // Set the expectation at the moment it is formed: the guest has just
      // committed and the only question in their head is "how long?".
      const wait = estimateWait(cart, extraMinutes);

      setProfile((p) => ({
        ...addEatenToProfile(p, { kcal: totals.kcal, protein: totals.protein }),
        name: name || p.name,
      }));

      orderKeyRef.current = null;
      setMyOrderIds((ids) => [...ids, data.order.id]);
      setCart([]);
      setShowBasket(false);
      setTab("orders");
      flash(strings.orderSentIn.replace("{min}", wait), "good");
      refreshOrders();
      refreshContext();
    } catch {
      setOrderError(strings.orderFailed);
    } finally {
      setSending(false);
    }
  }

  const loading = live === null;

  return (
    <div
      className="mx-auto flex min-h-[100dvh] max-w-lg flex-col bg-paper"
      style={{
        ...accentVars(restaurant.theme, mode === "dark"),
        // Measured by the bar itself rather than guessed, so the composer and
        // every scroll area clear it exactly in any font size or safe area.
        "--bar-h": `${barH}px`,
      }}
    >
      {/* ------------------------------------------------------------ header */}
      <header className="px-4 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-sunken text-[20px]"
            >
              {restaurant.emoji}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-bold leading-tight tracking-[-0.01em]">
                {restaurant.name}
              </h1>
              <p className="truncate text-[12px] leading-snug text-muted">
                {localized(restaurant.tagline, lang)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={toggleMode}
              aria-label={mode === "dark" ? strings.lightMode : strings.darkMode}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              {mode === "dark" ? <Sun size={17} weight="fill" /> : <Moon size={17} weight="fill" />}
            </button>
            <button
              onClick={() => setShowProfile(true)}
              aria-label={strings.profile}
              className="relative grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <User size={17} weight="fill" />
              {profile.allergens.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-paper" />
              )}
            </button>
          </div>
        </div>

        <div className="tnum mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px] text-muted">
          <span className="font-semibold text-ink">
            {strings.table} {table}
          </span>
          {weather && (
            <>
              <span aria-hidden="true" className="h-3 w-px bg-line" />
              <span className="inline-flex items-center gap-1">
                <Thermometer size={12} weight="bold" />
                {weather.tempC}&deg;C
              </span>
            </>
          )}
          {profile.kidsMode && <Badge tone="accent">{strings.kidsBadge}</Badge>}
          {profile.fasting !== "none" && <Badge tone="accent">{strings[profile.fasting]}</Badge>}
          {profile.allergens.length > 0 && (
            <Badge tone="danger">
              {profile.allergens.length} {strings.allergyBadge}
            </Badge>
          )}

          <span className="ml-auto flex items-center gap-0.5">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setProfile((p) => ({ ...p, lang: l.code }))}
                aria-pressed={lang === l.code}
                className={cx(
                  "rounded-chip px-1.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors duration-200",
                  lang === l.code ? "bg-ink text-paper" : "text-faint hover:text-ink"
                )}
              >
                {l.label}
              </button>
            ))}
          </span>
        </div>
      </header>

      {/* ----------------------------------------------------------- banners */}
      {kitchen.level !== "calm" && (
        <p className="mx-4 mb-2 flex items-center gap-2 rounded-control bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
          <Clock size={14} weight="fill" className="shrink-0" />
          <span className="tnum">
            {strings.kitchenBusy} {extraMinutes} {strings.minutes}
          </span>
        </p>
      )}
      {removed.length > 0 && (
        <button
          onClick={() => setShowProfile(true)}
          className="mx-4 mb-2 flex items-center gap-2 rounded-control bg-sunken px-3 py-2 text-left text-[11.5px] text-muted"
        >
          <EyeSlash size={13} weight="fill" className="shrink-0" />
          <span className="tnum flex-1">
            {removed.length} {strings.hiddenDishes}
          </span>
          <span className="shrink-0 font-medium text-accent">{strings.change}</span>
        </button>
      )}

      {/* -------------------------------------------------------------- body */}
      <main id="main" className="flex flex-1 flex-col px-4 pt-1" style={{ paddingBottom: "calc(var(--bar-h) + 1rem)" }}>
        {showAllergyPrompt && tab !== "orders" && (
          <div className="mb-3 rounded-card bg-raised p-4 shadow-card animate-rise-in">
            <div className="flex items-start gap-2.5">
              <FirstAid size={18} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">{strings.allergyPromptTitle}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-muted">
                  {strings.allergyPromptBody}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" size="sm" pill onClick={() => setShowProfile(true)}>
                {strings.setAllergies}
              </Button>
              <Button variant="ghost" size="sm" pill onClick={() => setDismissedAllergyPrompt(true)}>
                {strings.notNow}
              </Button>
            </div>
          </div>
        )}

        {tab === "ai" && (
          <AiWaiter
            slug={restaurant.slug}
            table={table}
            lang={lang}
            strings={strings}
            profile={profile}
            cart={cart}
            hunger={hunger}
            setHunger={setHunger}
            justTrained={justTrained}
            setJustTrained={setJustTrained}
            currency={restaurant.currency}
            extraMinutes={extraMinutes}
            pendingAsk={pendingAsk}
            onAskConsumed={() => setPendingAsk(null)}
            cartQty={(id) => cart.find((i) => i.dishId === id)?.qty || 0}
            favourites={profile.favourites}
            onToggleFavourite={favourite}
            onAdd={(d) => addToCart(restaurant.menu.find((m) => m.id === d.id) || d)}
            onSetQty={setQty}
            onOpenDish={(d) => setOpenDish(restaurant.menu.find((m) => m.id === d.id) || d)}
          />
        )}

        {tab === "menu" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {searching ? (
                <div className="flex flex-1 items-center rounded-full bg-sunken pr-1">
                  <MagnifyingGlass size={15} weight="bold" className="ml-3 shrink-0 text-faint" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={strings.searchPlaceholder}
                    aria-label={strings.searchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-[13.5px] outline-none placeholder:text-faint"
                  />
                  <button
                    onClick={() => {
                      setQuery("");
                      setSearching(false);
                    }}
                    aria-label={strings.close}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted"
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="no-bar -ml-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pl-4 pr-1">
                    {categories.map((c) => {
                      const on = category === c;
                      // Each category carries the glyph of its first dish, the
                      // reference's photo-in-pill treatment.
                      const face = c === "all" ? null : safe.find((d) => d.category === c);
                      return (
                        <button
                          key={c}
                          onClick={() => setCategory(c)}
                          aria-pressed={on}
                          className={cx(
                            "inline-flex shrink-0 items-center gap-1.5 rounded-full py-1.5 text-[13px] font-medium",
                            "transition-colors duration-200 ease-out active:scale-[0.96]",
                            face ? "pl-1.5 pr-3.5" : "px-3.5",
                            on ? "bg-accent text-accent-ink" : "bg-sunken text-muted hover:text-ink"
                          )}
                        >
                          {face && (
                            <span
                              aria-hidden="true"
                              className={cx(
                                "grid h-6 w-6 place-items-center rounded-full text-[13px]",
                                on ? "bg-accent-ink/20" : "bg-raised"
                              )}
                            >
                              {face.emoji}
                            </span>
                          )}
                          {c === "all" ? strings.all : c}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setSearching(true)}
                    aria-label={strings.searchPlaceholder}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-muted transition-colors hover:text-ink"
                  >
                    <MagnifyingGlass size={16} weight="bold" />
                  </button>
                </>
              )}
            </div>

            {loading ? (
              <div className="space-y-2.5" aria-busy="true" aria-label={strings.loading}>
                <DishSkeleton />
                <DishSkeleton />
                <DishSkeleton />
              </div>
            ) : visibleCount === 0 ? (
              <EmptyState
                icon={q ? MagnifyingGlass : EyeSlash}
                title={q ? strings.noMatches : strings.nothingHere}
                body={q ? strings.noMatchesBody : strings.nothingHereBody}
                action={
                  q ? (
                    <Button variant="soft" pill onClick={() => setQuery("")}>
                      {strings.clearSearch}
                    </Button>
                  ) : (
                    <Button variant="soft" pill onClick={() => setShowProfile(true)}>
                      {strings.profile}
                    </Button>
                  )
                }
              />
            ) : (
              sections.map((section) => (
                <section key={section.key} className="space-y-2.5">
                  {section.title && (
                    // Sticky so a long scroll always says which part of the
                    // menu you are in.
                    <h2 className="sticky top-0 z-bar -mx-4 bg-paper/95 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-faint backdrop-blur-md">
                      {section.title}
                      <span className="tnum ml-1.5 font-normal normal-case">
                        {section.dishes.length}
                      </span>
                    </h2>
                  )}
                  {section.dishes.map((d, i) => (
                    <DishCard
                      key={d.id}
                      dish={d}
                      lang={lang}
                      strings={strings}
                      currency={restaurant.currency}
                      extraMinutes={extraMinutes}
                      score={scores[d.id]}
                      inCart={cart.find((i2) => i2.dishId === d.id)?.qty || 0}
                      isFavourite={profile.favourites.includes(d.id)}
                      onToggleFavourite={favourite}
                      onAdd={addToCart}
                      onSetQty={setQty}
                      onOpen={setOpenDish}
                      index={i}
                      animate
                    />
                  ))}
                </section>
              ))
            )}
          </div>
        )}

        {tab === "orders" && (
          <OrderTracker
            slug={restaurant.slug}
            orders={orders}
            me={me}
            myOrderIds={myOrderIds}
            strings={strings}
            currency={restaurant.currency}
            quiz={restaurant.quiz}
            onRefresh={refreshOrders}
            onRate={(dishId, score) => {
              if (score > 0) setProfile((p) => rememberFavourite(p, dishId));
            }}
            onBrowse={() => setTab("menu")}
          />
        )}
      </main>

      <BottomBar
        tab={tab}
        onTab={setTab}
        action={action}
        orderCount={myOrders.filter((o) => o.status !== "served" && o.status !== "cancelled").length}
        strings={strings}
        onHeight={setBarH}
        onAction={(a) => (a.opens === "basket" ? setShowBasket(true) : setTab(a.to))}
      />

      {/* The pill is centred by a full-width container rather than by
          -translate-x-1/2: the entry animation also writes `transform`, which
          silently cancelled the horizontal centering. */}
      {toast && (
        <div
          className="pointer-events-none fixed inset-x-0 z-toast flex justify-center px-4"
          style={{ bottom: "calc(var(--bar-h) + 0.75rem)" }}
        >
          <p
            role="status"
            className={cx(
              "flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium shadow-lift animate-rise-in",
              toast.tone === "good" ? "bg-good text-white" : "bg-ink text-paper"
            )}
          >
            {toast.tone === "good" && <CheckCircle size={15} weight="fill" className="shrink-0" />}
            {toast.message}
          </p>
        </div>
      )}

      <DishSheet
        dish={openDish}
        open={Boolean(openDish)}
        lang={lang}
        strings={strings}
        currency={restaurant.currency}
        extraMinutes={extraMinutes}
        score={openDish ? scores[openDish.id] : null}
        qty={openDish ? cart.find((i) => i.dishId === openDish.id)?.qty || 0 : 0}
        isFavourite={openDish ? profile.favourites.includes(openDish.id) : false}
        onToggleFavourite={favourite}
        onClose={() => setOpenDish(null)}
        onAdd={addToCart}
        onSetQty={setQty}
        onAskAbout={askAbout}
      />

      <ProfileSheet
        open={showProfile}
        profile={profile}
        strings={strings}
        onClose={() => setShowProfile(false)}
        onSave={(p) => {
          setProfile(p);
          setShowProfile(false);
          setDismissedAllergyPrompt(true);
        }}
      />

      <BasketSheet
        open={showBasket}
        cart={cart}
        setCart={setCart}
        currency={restaurant.currency}
        strings={strings}
        profile={profile}
        hunger={hunger}
        justTrained={justTrained}
        extraMinutes={extraMinutes}
        sending={sending}
        error={orderError}
        onClose={() => setShowBasket(false)}
        onBrowse={() => {
          setShowBasket(false);
          setTab("menu");
        }}
        onSend={sendOrder}
      />
    </div>
  );
}
