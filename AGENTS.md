# AI Study Assistant - Agent Operating Rules

This repository uses:

* Next.js App Router
* TypeScript
* Supabase Auth
* Supabase Postgres
* Supabase Storage
* pgvector
* OpenAI-compatible APIs
* RAG + Quiz + Study Platform architecture

The agent must follow these rules.

---

# Project Goals

This is not a demo chatbot.

This project is evolving toward:

AI Study Platform

Core pillars:

* Documents
* RAG study chat
* Knowledge base chat
* Quiz generation
* Study persistence
* Learning dashboard

Prefer product-quality UX and minimal, incremental changes.

Do not redesign unrelated systems.

---

# Architecture Overview

Main flows:

Document Upload
-> Parse
-> Summary
-> Chunk
-> Embedding
-> Retrieval
-> RAG Answer

Document Chat
-> persistent
-> document_chat_messages

Knowledge Base Chat
-> cross-document retrieval
-> not persisted by design

Quiz
-> generate
-> save
-> load
-> delete
-> document_quizzes

Dashboard
-> user learning overview

---

# Database Notes

Important tables:

documents
document_chunks
document_chat_messages
document_quizzes

RLS is required.

Never bypass user isolation.

All user-facing data must be filtered by auth user.

---

# Coding Style

Prefer:

* minimal diffs
* focused changes
* small reusable components
* readable TypeScript
* explicit typing

Avoid:

* unrelated refactors
* large rewrites
* introducing new patterns without need
* moving files unnecessarily
* changing working APIs

Do not modify working retrieval logic unless explicitly requested.

---

# Next.js Rules

This project uses App Router.

Before changing Next.js behavior:

Read version-matched docs from:

node_modules/next/dist/docs/

Do not rely only on model memory.

Use existing route and component patterns.

Keep client/server boundaries correct.

---

# UI Rules

Prefer:

* practical UX
* progressive disclosure
* collapsible detail sections
* loading states
* empty states
* minimal visual noise

Avoid duplicate navigation or duplicate actions.

If two UI areas do the same thing, differentiate their purpose.

Examples:

Recent documents
-> continue reading / chatting

Recent quizzes
-> continue quiz / review

---

# AI / RAG Rules

RAG must prioritize:

1. grounded retrieval
2. citation visibility
3. useful answers
4. low hallucination

Do not silently remove sources.

If retrieval quality is weak:

improve presentation or prompting first.

Do not change embeddings or vector schema without approval.

---

# Quiz Rules

Quiz system principles:

* persistence
* reloadable
* deletable
* study-oriented

Prefer:

* question diversity
* history-aware generation
* minimal friction

Avoid identical quiz regeneration.

Do not add grading, spaced repetition, analytics, or gamification unless requested.

---

# Commands

Preferred:

Type check:

npx tsc --noEmit

Targeted tests:

node --test tests/<file>.mjs

Avoid:

npm run build
npm run lint

unless explicitly requested.

Do not start dev server.

Do not run build automatically.

---

# Agent Workflow

For implementation tasks:

1. inspect existing code
2. explain plan briefly
3. make minimal change
4. run targeted validation
5. report:

* modified files
* test commands
* how to verify

Do not over-engineer.

Prefer shipping working increments.

---

# Done Criteria

A task is done only if:

* feature works
* existing behavior still works
* targeted tests pass
* UX is verified
* no unrelated regressions introduced
