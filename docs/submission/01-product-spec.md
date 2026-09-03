# NestUp — Product Specification

**Course:** Internet Technologies — Become a Full-Stack Engineer, RUNI CS 2026
**Live product:** https://nestup-kappa.vercel.app
**Repository:** https://github.com/nestupweb/nestup

---

## 1. The problem

Finding a room in a shared apartment is not actually a search problem. The listings themselves are easy to find, since they are published on Facebook groups, on Yad2 and in WhatsApp groups. The real difficulty is that **the room is not what a person is choosing. The people are.**

Existing tools approach this from the wrong direction. They index apartments according to rent, number of rooms, size in square meters and neighborhood. All of the factors that actually determine whether a shared apartment will work, such as sleeping hours, how frequently guests arrive, how clean the kitchen is kept, whether someone smokes indoors, and whether the apartment keeps Shabbat, are either missing entirely or written in free text which cannot be filtered.

The result is a process which wastes time on both sides:

- **The seeker** sends messages to thirty listings, receives eight replies, visits four apartments, and only then discovers the incompatibility in person, after having traveled across the city.
- **The household** receives dozens of nearly identical messages asking whether the room is still available, repeats the same screening questions to each one of them, and nevertheless ends up meeting people who were never suitable in the first place.

Both sides therefore perform manual filtering which a computer could perform on their behalf, and both sides perform it *after* the expensive step of traveling and meeting, rather than before it.

There is a second problem, which is less obvious. Once a conversation does begin, it normally begins with **one** roommate, usually the person who published the advertisement, even though the decision belongs to the entire household. The remaining roommates receive only a summary of what was said. For this reason NestUp treats the household, and not the individual poster, as the counterparty.

## 2. Who the users are

NestUp is a **two-sided product**. The same person may be on both sides at different stages of life, and a single account supports both roles without requiring the user to switch between modes.

### Side A — the Seeker

A person who is looking for a room in an existing shared apartment.

- Typically between the ages of 22 and 35: students, young professionals, and people relocating for work.
- Cares about monthly rent, location, move-in date, and, which is the part that other products ignore, the identity of the people he or she will be living with.
- The scarce resource of this user is **time and travel**. Every apartment visit costs an entire evening.
- The main fear of this user is committing to a full year with people who turn out to be impossible to live with.

### Side B — the Household (Lister)

An existing shared apartment which has a room to fill.

- One member publishes the room, but the room belongs to the household as a whole.
- Cares about filling the room quickly, and about filling it with a person who will not disrupt an apartment which already functions well.
- The scarce resource of this user is **attention**. A household cannot interview forty candidates.
- The main fear of this user is accepting an unsuitable roommate and then being unable to remove him or her.

### Who the customer is

In this project the **user and the customer are the same person**, and the product is free at the point of use. This decision is deliberate. A two-sided marketplace has no value for either side until it achieves liquidity on both sides, and therefore charging money at an early stage would suppress the very mechanism which makes the product work.

The customer that NestUp would eventually be built toward is the **household with a vacancy**, because this is the side which has urgency and a measurable cost of failure. An empty room represents rent which somebody is paying out of pocket for every month that it remains empty. This is therefore the side with a genuine willingness to pay, and the monetization discussion below assumes exactly this.

## 3. Business goals

| Goal | Why it matters | How the product serves it |
|---|---|---|
| **Reduce wasted first meetings** | This is the core value promise. If a seeker visits three apartments instead of ten and still finds a home, the product has already justified itself in saved evenings. | Compatibility scoring, together with a swipe deck which presents strong matches only |
| **Build two-sided liquidity** | A matching product which has rooms but no seekers, or seekers but no rooms, provides no value at all. | Public browsing without a registration barrier; listing creation with low friction |
| **Make the household the counterparty** | This is both a differentiator and a genuinely better process. | Household-wide chat threads; co-owned listings; a listing which survives its original poster |
| **Keep members inside the product** | If the conversation moves to WhatsApp immediately after first contact, the product loses the relationship and every signal associated with it. | In-app chat with realtime delivery, photo and video sharing, and viewing scheduling built directly into the thread |
| **Earn trust** | Members are sharing where they live and who they are. A single bad incident costs more than ten successful matches produce. | Real authentication, per-row access control, reporting, blocking, and suspension |

### How the product would generate revenue (not implemented; stated as intent)

The natural model is **paid promotion on the household side**. A listing which is not filling could pay in order to be positioned higher in the decks of seekers. This model is aligned with the value that is actually delivered, because the product only charges money when it is demonstrably performing the work, and it charges the side which has urgency. A secondary revenue line would be a verification badge, offered to both sides.

It should be emphasized that nothing in the current product charges anybody. Both the database schema and the ranking function would need to be modified in order to support this, and this fact is stated honestly in the scale document as future work rather than presented as something which already exists.

## 4. Software capabilities required

Working backwards from the goals described above, the following are the capabilities which the product was required to have.

### 4.1 Identity and trust

- Email and password authentication with **mandatory email confirmation**. This is a deliberate decision, since it is the least expensive barrier against disposable accounts in a product where people eventually meet in real life.
- Password recovery.
- A profile which carries sufficient information about a person to allow matching.
- Reporting, blocking, and account suspension.
- Account deletion which does not destroy the data of other members.

### 4.2 Supply: rooms

- Creating, editing, pausing, marking as taken and removing a listing.
- Photographs, including a check that a photograph of a bedroom genuinely shows a bedroom.
- A real geographic location.
- Support for multiple roommates who co-own a single listing.

### 4.3 Demand: discovery

- Public browsing, with filtering and sorting, which does not require an account.
- A map showing every room which has a placed location.
- A personalized swipe deck for signed-in members who have completed their profile.

### 4.4 The matching itself

- A **Lifestyle** score, calculated from budget, city, move-in date, smoking, pets, cleanliness, sleep schedule, guests, noise, diet and Shabbat.
- A **Social** score, calculated from shared interests.
- A threshold which causes the deck to present strong matches only, rather than presenting everything in sorted order.

### 4.5 Communication

- One chat thread per (listing, seeker) pair, which contains the **entire household**.
- Realtime delivery, read state, and unread counters.
- Photo and video messages.
- Viewing proposal and approval inside the thread, with optional export to Google Calendar.

## 5. Main user flows

### 5.1 Seeker: discover, match, and meet

1. **Browsing without an account.** The `/browse` route is public. The user can filter by city, rent, move-in date, lease length, number of roommates, pets, smoking, balcony, air conditioning, parking, elevator, furnishing and safe room, and can sort by newest or by price. The map view presents every placed room at once.
2. **Opening a room.** The user sees photographs, full details, the identity of the people who already live there, and a map showing the room together with its neighbors.
3. **Registering and building a profile.** The user provides name, age, occupation, biography and photograph; budget, preferred cities, move-in date and lease length; the Daily-life questionnaire, which describes how the user personally lives; roommate preferences, which describe what the user expects from others; and interests.
4. **Swiping.** The `/swipe` route presents a ranked deck of rooms whose combined score is 60 or above. The user may like or skip each one. A like optionally opens a chat containing a pre-filled greeting.
5. **Chatting with the household.** Every roommate participates in the thread.
6. **Scheduling a viewing** from inside the chat. The household approves the proposal, and either side may export it to Google Calendar.

### 5.2 Household: publish, screen, and fill

1. **Creating a listing.** The household provides an address, which is geocoded automatically or positioned by dragging the pin, together with rent, number of rooms, size, available-from date, lease term, amenities, house rules and up to five photographs.
2. **Tagging the roommates** who live in the apartment. Each of them receives an invitation, and accepting it makes that person a co-owner who may edit the listing and who appears as part of the household.
3. **Receiving interest**, meaning likes and messages, all of which arrive in a single inbox.
4. **Screening with real information.** Every seeker who writes a message has a profile which carries a compatibility score against the specific room.
5. **Approving a viewing** from within the chat.
6. **Closing the room**, by marking it as taken, pausing it or removing it. Existing conversations continue to exist in all three cases.

### 5.3 Cross-cutting flows

- **Account management:** notification settings and contact-visibility settings, the list of blocked members, changing the email address or password, and account deletion, which transfers a shared listing to a roommate instead of deleting it.
- **Moderation:** reporting a member or a listing. Blocking is mutual and removes the blocked member from both decks, and a suspension closes the application immediately.

## 6. What is deliberately outside the scope

Stating these items is as important as stating the feature list, because the assignment asks for clear thinking rather than for the maximum possible surface area.

- **No payments.** There are no deposits, no rent collection and no escrow. Money moves outside the product.
- **No contracts and no electronic signature.** A lease is a legal instrument, and producing an imitation of one would be worse than omitting it entirely.
- **No identity verification.** Only email confirmation is performed. Genuine KYC requires an external vendor and a budget.
- **No native mobile application.** The web application is mobile-first and can be installed as a PWA.
- **No machine learning in the recommendations.** Ranking is performed by a deterministic scoring function and not by a trained model. Consequently it is explainable, testable and debuggable, which at this stage is more valuable than being marginally more accurate.

## 7. How success would be measured

If this were a real product, the following are the metrics which would matter. They were chosen specifically so that the product cannot appear successful while it is in fact failing its users.

| Metric | Why this metric was chosen |
|---|---|
| Viewings per successful match | This is the core promise of the product, and a lower value is better. |
| Proportion of decks which are not empty | An empty personalized deck is the principal failure mode of a strict matching threshold. |
| Time from publication of a listing until the room is filled | This is the actual problem of the household. |
| Reply rate to the first message | This indicates whether the two sides are genuinely well matched, and not merely matched. |
| Reports per thousand conversations | This measures trust. An increase in this metric outweighs an improvement in all of the others. |

---

*Companion documents: [Technical Design](02-technical-design.md) · [Test Specification](03-test-spec.md) · [Scale](04-scale.md) · [Security](05-security.md)*
