
# Contextual Recall

Basically - the plugin for memorization with SRS algorithm. 

I've built this, because can't find any plugin satisfied my willings enough.
What I want from "recalling" / spaced repetition / flashcards system, is the ability to memorize IN the context and very NATIVE - means no need for extra tags, extra metadata in your markdown. 

That's the whole difference. ContextualRecall is trying to build system you can use natively integrate in your note-taking experience, provide you with the journey (you can start from any card or idea), where all followup cards are interconnected by the context.
I've synthesized few types of context's categories:

1. Just in-file context. You can have dozens of questions in one file, i.e for one subject or one book, separated by headers, but they're in one context.
2. Cross-links (If one note has `[[link]]` to another)
3. Time-lane
That's the most funny stuff. Basically, time's perception is very interesting stuff, because that's how our brain organize emotions, things, and that's can be very (potentially) beneficial for include this feature in learning.

Then your journey will generated according this definition of the context. You will no see the chaotic cards, instead, you will go in the prefferable context, like you're working in the real world, solving the problem, and gathering all the pieces together.

# How to use 

Just enable plugin, and then call via *command pallette* (`cmd+P / ctrl+P`) typing `Contextual Recall` necessary commands. 
1. For tracking note you may use `Track this note for SRS`
2. For starting your journey in arbitrary place: `Review all due cards`
3. For starting your journey more semantically, in preferred place: `Start from a specific tracked note`
4. To refresh stuff, just `Reindex all tracked notes`
5. To stop tracking, just: `Untrack this note for SRS`

**Keyboard** 
- _In card-view mode_; **Enter**: to reveal the answer
- _In answered card_; **Enter** to quick answer 'Good' 

**Warning** 
System tracks your notes via unique ID, even if you change your note's name - it's okey!
You can dynamically fill the content of your note, it will render immediately in card's review!


# Todo 

- More adjusted parser "AST"
- Configuration different types of notes, for parser
- Context development
- Embeddings / AI (?) Big plans.

