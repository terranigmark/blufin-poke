---
name: ai-design-process
description: Discover/Define/Deliver process for getting genuinely distinctive visual design out of an AI agent instead of default slop. Use when starting a new UI/landing-page/app design from a blank slate, when a design looks generic or "AI-generated," or when the user asks to explore design directions, push a design further, or polish one before shipping. Standalone: covers exploration (seed-string variety, ambitious prompting), iteration (subagent design critics, image-generation enrichment), and polish (AI-tell removal, restraint, copy) end to end.
---

# AI Design Process

Source: Anshu Chimala, "How to turn your AI into a world-class designer" (Lenny's Newsletter, Sep 2026). Core insight: an LLM predicts the *most likely* next token, so left to its defaults it makes the safest, most average design choice at every step — design-by-committee. Getting distinctive output requires deliberately injecting variety and judgment from outside the model at each of three stages.

1. **Discover** — explore a wide space of directions before committing to one.
2. **Define** — push the chosen direction further than the model would go on its own.
3. **Deliver** — cut what doesn't earn its place and remove the tells.

## Discover: explore before committing

A bare prompt ("build me a landing page for my app") always regresses to the same defaults — same layout, same purplish gradient. Asking for "something random" doesn't help either: the model still predicts the most likely-sounding "random" tokens, which is not actually random. Variety has to come from outside the model.

**Seed strings.** Have the agent generate a random string itself (e.g. via a shell one-liner) and mine it for inspiration — subpatterns, repeated characters, numbers that suggest a theme — before making any design decision. This forces a genuinely different starting point on every run instead of a stylistically-random-sounding rehash of the same defaults. Prompt shape:

> Generate a long, random alphanumeric string using a shell script. Define the creative direction (color scheme, layout, typography, etc.) based on the string — look beyond the surface for subpatterns, special numbers, anything that inspires you. Then use your judgment to bring this direction to life. Don't reveal the string in the design; it's only for your inspiration.

**Ambitious, specific prompts.** Give the model a concrete external inspiration to build from rather than leaving the direction open — a video game, an interior-design trend, an art installation, a material. Vague requests for "bold" or "unique" design get the same average result as no request at all. Concrete external references don't: "pixel art, each section a still from a game," "isometric living 3D city where features are neighborhoods," "radically asymmetric, dissonant colors, uncomfortable negative space — break the rules but keep it working."

**Bootstrapping ideas with AI itself.** Don't ask the model for design ideas and use its first answer — that's the same average result everyone else gets. Instead run this loop:
1. Ask for many *shallow* ideas, explicitly requesting breadth over depth ("list as many bold, unique design-language directions as you can, short high-level descriptions each, go broad not deep").
2. Visualize the ones that provoke a reaction (positive or negative) and react to them concretely — what to keep, what to cut, what to avoid — then ask the model to sharpen just that one based on your reaction.
3. Once it's shaped, ask the model to turn it into a concise build prompt for an implementer agent.

Don't be afraid of ideas that sound like they won't work — that instinct is usually a sign you've left the model's comfort zone, which is the point. Save prompts that flop; retest them against newer models later.

## Define: push the chosen direction further

The first pass at any direction, however promising, still leans on stale structural habits (nav bar top, text left, CTA below, graphic right). Two techniques to deepen it:

**Subagent design critic loop.** Don't let the same agent that built the design also judge it — it's reviewing its own code and rationale, and can't zoom out. Use a *separate* agent as an unbiased critic instead, invoked fresh each iteration with only a screenshot — never the code, the implementation history, or prior critiques. Loop until the critic independently converges, without ever telling the critic what score counts as "done."

Guidance for the critic prompt:
- Ask it to name the aesthetic being attempted, imagine how a top studio would execute *that same aesthetic*, and identify the concrete gaps between the two.
- Have it flag anything that reads as overdone, excessive, or generically AI-generated.
- Demand tight, specific feedback — not vague prose — and require it to take a stance rather than defaulting to "safe."
- Make the judgment criterion as concrete as possible. Vague ("does this look beautiful, not AI-generated?") gets vague, inconsistent answers. Better: give it a rubric to reason against. Best: give it comparison images — real professional examples plus the current screenshot — and ask it to rank by polish, explicitly as a baseline/moodboard rather than a copy target.
- Cap iterations up front (try 1–2 first) so the loop can't stall burning tokens chasing an uncalibrated critic that never says "good enough."
- Bias the critic toward the stronger/pricier model in the pairing and the builder toward a cheaper, faster one — taste calls are the expensive part, execution is not. The critic is typically a small fraction of total output tokens even when it's the larger model.

**Image generation to escape code-only defaults.** Coding agents default to gradients, shapes, and CSS patterns because that's the easy path — and those are exactly the tells that read as AI-generated. Explicitly ask for image generation instead of code-only effects (shaders/3D layered with generated imagery reads far richer than gradients alone). Depending on toolchain:
- Agent has built-in image gen (e.g. Codex, Antigravity, Grok Build): tell it to actually use that tool — it knows how but won't by default.
- Have a ChatGPT subscription but a different coding agent: point it at the Codex CLI for image generation billed to the subscription, not a separate API key.
- Otherwise: hand the agent a scoped API key (OpenAI/Gemini) with a tight spend cap dedicated to this use, so a leak or misuse is cheap to contain and easy to revoke. Store it in a gitignored file (e.g. `.env.agents`) rather than pasting it into chat repeatedly, and note in `CLAUDE.md`/`AGENTS.md` that it's a dev-only key that must never ship in the product.

## Deliver: cut and polish

Polish is largely subtractive. AI adds, it rarely removes — a design that "overexplains" or carries elements with no practical purpose is one of the clearest tells that it's AI-generated. A design that shows restraint reads as premium immediately. Don't trust an initial "minimalist" request to have actually produced minimalism — look it over and actively ask what needs to be cut: glow effects, redundant labels, decorative containers, empty space padding out a grid whose images already communicate the content, custom buttons/fields that look worse than the platform's native components. Putting less on screen usually communicates more, because it's not competing for attention. This is a deliberate push you have to make — stripping down a working design and deleting code is exactly the kind of risk the model won't take on its own.

**Common AI design tells and better alternatives.** These aren't blanket bans — each pattern has legitimate uses — but once you notice one, deliberately consider the alternative rather than defaulting to it:

| Overused pattern | Better alternative |
|---|---|
| Eyebrow text: small redundant labels stating the obvious | Nine times out of ten, just remove it — nothing is lost |
| Generic background gradients | Background images, patterns, or even flat solid color |
| Excessive cards and containers | Flatter layouts: grids or tiles without a box around every group |
| Too many fonts, text styles, and type levels | Start with 1–2 fonts and 2–4 styles; add accent color/italics sparingly, only once you actually need more |

Prompt the agent to try the alternative and compare, rather than banning the pattern outright — an agent told never to use gradients/cards/labels tends to overcorrect into other, stranger tells instead of just making a better call.

**Rewrite copy by hand.** Model-written copy doesn't affect layout, but it's often the single biggest signal of "AI slop" to a reader, because everyone is now fatigued by AI-generated prose and skims past it on sight. Treat AI copy the way a designer treats Lorem ipsum: useful for visualizing structure, not something to ship. Read every line the model wrote and rewrite it by hand (or have the agent rewrite explicitly for brevity and a specific, consistent voice) — the human version is almost always shorter, plainer, and less performative than the model's first draft. Concretely: cut throat-clearing setup sentences, cut restated context the reader already has, keep the concrete specific claim, end on the actual action.
