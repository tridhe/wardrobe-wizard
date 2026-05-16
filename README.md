# Aura

Aura is a personal style AI built for a hackathon with OpenAI, Pioneer, and fal.ai as partner technologies. The app helps people turn their real wardrobe into an intelligent styling system: upload clothes, describe where you are going, match inspiration looks, coordinate with another person, and generate realistic try-on previews.

## What We Are Building

Aura is meant to help users shop their own closet before buying something new. A user uploads wardrobe pieces into a digital closet, and the app uses AI to understand each item, recommend outfits for real situations, and visualize the result on the user's own photo.

The core experience is:

- **Closet**: upload clothing items, auto-tag them, search, filter, and manage the wardrobe.
- **Stylist**: chat with Aura about an event and get a complete outfit using only owned items.
- **Styler**: manually pick pieces from the closet and generate a try-on image.
- **Today**: connect Google Calendar and receive outfit options for the day's events.
- **Inspiration**: upload a screenshot or reference look and find similar pieces already in the closet.
- **Collaborate**: privately coordinate outfits with another person without exposing either wardrobe.
- **Outfits**: save generated looks for later.

## Partner Integrations

Aura uses all three hackathon partner technologies:

- **OpenAI** powers the stylist reasoning, outfit planning, clothing image tagging, inspiration analysis, and collaborative styling logic.
- **Pioneer** extracts structured styling context from natural-language prompts, such as occasion, venue, dress code, weather hints, color preferences, garments, and avoidances.
- **fal.ai** generates realistic try-on images using the user's avatar and selected clothing items.

In short: **Pioneer understands the styling intent, OpenAI chooses and explains the outfit, and fal.ai renders the user wearing it.**

## How We Use Each Partner

### OpenAI

OpenAI is the reasoning layer of Aura. We use it to understand clothing photos, generate rich wardrobe metadata, analyze inspiration images, and plan outfits from the user's own closet.

In the app, OpenAI helps with:

- **Auto-tagging closet uploads** by detecting color, garment type, fit, material, season, occasion, and style tags.
- **Stylist chat** by choosing complete outfits from the user's wardrobe based on an event prompt.
- **Inspiration matching** by reading a reference outfit image and finding similar owned pieces.
- **Today planning** by turning calendar events into outfit options.
- **Collaborative styling** by creating coordinated looks while only revealing the current user's recommended outfit.

### Pioneer

Pioneer is used to make the user's natural-language styling request more structured. When someone says something like "rooftop dinner tonight, slightly chilly, not too formal," Pioneer extracts useful signals such as occasion, location, dress code, weather hints, garments, colors, and avoidances.

Aura then passes that structured context into the styling flow so the outfit recommendation is more precise and grounded in the user's intent.

### fal.ai

fal.ai powers the visual try-on experience. After OpenAI selects or the user manually picks clothing items, Aura sends the user's avatar and selected garment images to fal.ai to generate a realistic image of the user wearing the look.

We use fal.ai for:

- Generated looks from the Stylist chat.
- Manual outfit previews in Styler.
- Try-ons for calendar-based outfit suggestions.
- Try-ons from inspiration-matched closet items.

## Partner Flow

The core AI pipeline is:

1. **Pioneer** extracts what the user means.
2. **OpenAI** reasons over the wardrobe and chooses the best outfit.
3. **fal.ai** visualizes the result as a try-on image.

That gives Aura a complete loop: understand the situation, style from real owned clothes, and show the final look.
