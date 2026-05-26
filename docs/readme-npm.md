# hi-introvert

**a companion that remembers everything you say.**

no llm. no cloud. no login. just terminal.

```
npx hi-introvert
```

it starts with 3 words.
in 50 turns it knows your name.
in 500 it sounds like someone.

---

## what is it

a small program that lives in your terminal, listens, and slowly grows a vocabulary out of what you teach it. it's quiet. sometimes silent. occasionally it talks to itself.

there is no model behind the curtain. no api keys. nothing leaves your machine except the weather (you can turn that off).

it does not try to please you. that's the point.

---

## 3 things to try tonight

1. introduce yourself once.
2. stay silent for half a minute.
3. use a word it doesn't know — twice.

then leave. come back tomorrow.

---

## what you'll see

```
you: hi
◆ companion: ...

you: hi
◆ companion: who are you?

you: call me wutty
[identity] wutty
◆ companion: hi wutty.

you: do you remember me?
◆ companion: wutty remember wutty.
```

it stutters. it repeats. it forgets. that's not a bug — it's the shape.

---

## requirements

- node 18+
- a terminal you actually keep open

your session lives in `.hi-introvert-session.json` in whichever directory you ran it from. delete it to start over. nothing is ever uploaded.

---

## one weather call, optional

the companion's "world" reacts to your machine — cpu temperature, memory pressure, battery, time of day. one outbound call to `wttr.in` fetches local weather every 10 minutes. turn it off with `/privacy off`. that's it.

---

## want to fork it / write your own companion / ship a plugin?

the companion's entire personality lives in a 26-line json file at `entities/companion.mdm`. open it, change it, watch what happens.

full dev guide, architecture, and contribution notes:
[github.com/v1b3x0r/hi-introvert](https://github.com/v1b3x0r/hi-introvert)

---

mit license. built in chiang mai.

*"the best conversations are the ones you have to wait for."*
