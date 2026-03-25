# START SESSION

--> session-start

---

--> session-fail (error)

---

--> session-success

---

--> session-resume

---

--> session-await-input

# RUN ATTEMPT

start attempt with worktree
--> create worktree
--> post-worktree-create
--> session-start

---

--> session-fail (error)

---

--> session-success

---

--> session-resume

---

--> session-await-input

---

agent actions:

--> mark-attempt-<running>
--> mark-attempt-<blocked>
--> mark-attempt-<review-ready>
--> mark-attempt-<reviewed>

session hooks have access to the attempt-status so then

post-session-success

if mark-attempt = review-ready -> start review agent session

---
