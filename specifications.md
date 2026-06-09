# Summary Information

## Overview

When an adult approaches library staff with a reference question, they generally know what they’re looking for: title, author, or at the very least, subject or genre. However, when a child comes up and asks for “the alphabet book” what do they mean? And how do you, as a library professional, help them find it? You could search by subject or keyword, of course, but that might not get you the results the child is looking for. Children have a different way of remembering things; the color of the cover, the species of the main character, even the way it made them feel (“No, the funny alphabet book.”) and may have a limited vocabulary to express those ideas. Is it a picture book, graphic novel, part of a series, or an early chapter book? And what happens if they’re looking for a new book altogether? Recommendations for Youth Services based on material isn’t as straightforward as it is for other library user groups. A book about crayons like “The Day the Crayons Quit” doesn’t necessarily translate to other books about art (or art supplies) but rather the sense of humor and imagination that comes from Drew Daywalt books. While library staff could recommend other books from the same author, how else can you find similar books? Bob Shea has no overlap in subject matter, but the books often feel similar. This level of specificity for discovery, linked data, and reference is wholly unique to children’s literature but has yet to be fully explored and actualized. Though there are excellent Children’s Librarians in our system who might know off \-hand that “Creepy Pair of Underwear” and “Don’t Trust Fish” have a similar style, we cannot always rely on them being available, or even the ones being asked, especially if a patron is trying to access this information digitally.

By creating a new discover app that expands how we catalogue books by adding physical characteristics, similar developmental themes and lyrical style, and series information to existing MARC Records, as well as incorporating Book Recommendation skills from Generative AI such as ChatGPT and linked data, the library aims to create a new search and discovery tool specifically for our youngest patrons. This app would utilize significantly more images and simplified design elements to engage, interact, and serve young children.

At the Organization, we serve over 100,000 children a year and house over 250,000 items dedicated to young readers. And while our youngest patrons may not be the most vocal, they are deserving of a discovery app that addresses their specific information and technological needs, as are the Children’s Services professionals who primarily work with them. The Organization continues to look for innovative ways to serve our patrons and by developing and expanding new services and technology such as this, we can uphold the Organization’s continued mission to better serve the children who rely on the library.

## Users

Young children, ages 3-10, are the primary intended users of the app. The system is designed to help them locate books using visual descriptions, emotional associations, colors, characters, themes, or story elements rather than relying solely on traditional catalog searches such as title or author. Children three to six would likely use the app with assistance from caregivers or library staff, while ages seven to ten may engage more independently.

Secondary users include parents and caregivers, who would use the app to assist children in locating books and discover new reading materials. Children librarians are another user group, who could use the app to generate personalized book recommendations and support storytime planning. The app would function as an enhanced discovery and advisory tool that complements librarians’ professional knowledge while improving efficiency during reference interactions. Other library staff could use the app to assist children with locating books in the stacks and recommend similar materials, which would increase staff confidence and improve overall patron service experiences. Volunteers could use it to assist caregivers looking for books and helping children independently explore reading materials. The simplified and visual design of the app would make it easier for volunteers without extensive catalog training.

## Use Cases

The discovery app would be used to improve searching by children and caregivers for and discover children’s books within the public library systems. Primary use is book discovery through descriptive searching. Children could search for books using colors, character types, memorable story elements, and visual descriptions, instead of needing exact titles or authors. The app would use linked data and recommendation tools to suggest similar books, related authors, matching humor or writing styles, which would strengthen reader advisory services for children. Library staff and volunteers could use the app during reference interactions, storytimes, literacy programs, and reader advisory activities in order to improve service efficiency and user engagement.

# Features & Functionality

## App Functionality

The Children's Discovery tool allows parents, children, and caregivers to find children's books via natural language search and enhanced recommendations of similar books of a particular title. These two core functionalities are made possible through the use of vector embeddings of existing catalog metadata fields, as well as additional custom fields which broaden the descriptive information of each book.

The application will be a responsive web application. The application will be compatible on desktop & mobile devices and a touch screen kiosk (TBD how kiosk version varies from desktop designs).

### Search

**Phase 1**  
Users search for children's books using natural language phrases and queries. The search query is converted into a vector embedding and compared against the embeddings of various catalog metadata fields. The search functionality will initially utilize title, author, abstract,and keyword metadata fields.

**Phase 2 & Beyond**  
Future functionality will expand to include language, date of publication range (1980s, 1990s, etc), classic characters, genre, age recommendation, and format. At a later date, evaluations will be conducted to expand to multimodal search cover images.

**Additional Considerations**  
Formats: Picture Books (Everybody or “E” books), Early Chapter Books, Chapter Books/ Fiction, Graphic Novels

Themes: Spooky/ Mystery, Funny, Fantasy, Adventure, Animals, etc.

TV or Film Characters: Bluey, Disney, etc.

Common Characters and their links: Pete the Cat, Dog Man, Eric Carle….

### Related Recommendations

**Phase 1**  
Users enter the title of a book to help discover similar books. The recommendation algorithm will compare vector embeddings of standard cataloging fields (author, title, summary) along with the additional fields including themes, tones, character traits, and more. and related series or similar author styles.

**Phase 2**  
Future discoverability will be enhanced through visual representation of themes, genres, etc. empowering younger patrons to visually explore related recommendations.

Examples for Genres:

- [Example 1](https://www.demco.com/demco-reg-dewey-reg-end-panel-sign-set)
- [Example 2](https://www.titlewave.com/search?utm_medium=referral&nodeid=230207&utm_source=follettcontent.com&utm_campaign=CY24_Content_All_Digital-Marketing&utm_content=Link_Year-Round_Genres&directlogin=Y)

## Out of Scope

Phase 1 of the project will not include the following functionality:

- Complex metadata searching capabilities
- Multi-modal search (comparing words and images)
- Image search \- embeddings of book covers and other images will not be generated/utilized
- Full inclusion of LAPL’s offering of children’s books

## Data & Content

### Data Structure

Book

- title (text)
- author (relation Author)
- abstract (text)
- keywords (relation array Keyword)

Author

- firstName (text)
- lastName (text)

Keyword

- keyword (text)

## Technical Specifications

| Framework                        | [NextJS v16](https://nextjs.org/)                                                               |
| :------------------------------- | :---------------------------------------------------------------------------------------------- |
| **Runtime**                      | [Bun](https://bun.com/)                                                                         |
| **Programming Language**         | [Typescript](https://www.typescriptlang.org/)                                                   |
| **Database**                     | [PostgreSQL](https://www.postgresql.org/) with [pgvector](https://github.com/pgvector/pgvector) |
| **Lint & Formatting**            | [Biome](https://biomejs.dev/)                                                                   |
| **ORM**                          | [Drizzle](https://orm.drizzle.team/)                                                            |
| **CSS Framework**                | [Tailwind v4](https://tailwindcss.com/)                                                         |
| **Component Library**            | [ShadCN UI](https://ui.shadcn.com/)                                                             |
| **Application Hosting Platform** | [Vercel](https://vercel.com/)                                                                   |
| **DB Hosting Platform**          | TBD                                                                                             |
| **AI Framework**                 | [AI SDK](https://ai-sdk.dev/)                                                                   |
| **Embedding Model**              | [OpenAI text-embedding-3-small](https://platform.openai.com/docs/guides/embeddings)             |
| **LLM Model**                    | TBD                                                                                             |

## Planning Questions & Answers

Scope And Audience

1. Is Phase 1 intended primarily as a staff-facing prototype, child-facing prototype, or both?

- user facing prototype for now

2. Should the first prototype optimize more for desktop/library-staff use, mobile/caregiver use, or touchscreen kiosk use?

- desktop display, with mobile responsive styling as possible

3. Should Phase 1 include a polished visual interface for children, or mainly prove the search and recommendation workflows?

- functionality first, with visual polish as possible

Data

4. What source data will we use for the Phase 1 catalog sample: hand-entered seed data, exported MARC/catalog records, an API, or another dataset?

- the prototype will use a sample dataset in CSV or similar format which will get imported into the database (add a step for creating that script)

5. Roughly how many books should the prototype support in Phase 1?

- 50 books (may vary)

6. Should Phase 1 include only the basic fields listed in the spec, or should we also seed the extra recommendation fields like themes, tones, character traits, and author style?

- only the basic fields listed in the spec for now

7. Who will create or validate the custom metadata fields for the prototype?

- the prototype will use the existing metadata fields from the catalog records

Search

8. Should natural language search return only ranked book results, or should it also explain why each result matched?

- only ranked book results for now

9. Should Phase 1 support typo tolerance or fuzzy matching in addition to vector similarity?

- TBD depending on scope, but ideally yes

10. Should search be purely semantic/vector-based, or should we combine vector similarity with keyword/title/author matching?

- TBD but ideally combined - please outline the considerations for both approaches in the planning document

Recommendations

11. For “users enter the title of a book,” should they type an exact title, select from autocomplete results, or both?

- no autocomplete results for now

12. Should recommendations be limited to books in the prototype database, or can AI suggest books outside the local dataset?

- just within the prototype database for now

13. Should recommendation results explain similarity, such as “similar humor,” “same theme,” or “same author style”?

- no explanation for now

14. How many recommendations should be shown per book in Phase 1?

- up to 10 recommendations per book for now but should not force if similarlity score is low

AI And Technical Choices

15. Do we already have an OpenAI API key/account available for the prototype?

- i will add it to the .env file

16. Is text-embedding-3-small locked in, or should the plan mention evaluating embedding model alternatives?

- locked in for now

17. Should the LLM model remain TBD in the plan, or do you want a recommendation included?

- TBD for now - the AI SDK allows for quick/easy integration of different LLM models

18. Do you have a preferred DB hosting direction for the prototype, such as Supabase, Neon, Vercel Postgres, local-only Docker, or leave as TBD?

- likely Supabase

Planning Document

19. Should the planning document be written as an implementation roadmap, a stakeholder-facing prototype plan, or a hybrid?

- implementation roadmap

20. Do you want the plan saved as a new Markdown file in the repo, and if so, what filename should it use?

- yes include in the repo as plan.md

21. Should the plan include estimated phases/timelines, or only ordered implementation tasks?

- group into milestones but no need to estimate level of effort/time

22. Should future phases stay very high level, or should they include concrete candidate features and dependencies?

- use your judgement based on the information provided in the specificastions document
