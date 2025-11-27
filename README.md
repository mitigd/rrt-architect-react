# RRT Architect (react version)

[Play Now](https://mitigd.github.io/rrt-architect-react/)

## Overview

RRT (Relational Reasoning Training) Architect is a cognitive training application based on the principles of Relational Frame Theory (RFT). It generates procedural logic puzzles that require the user to derive relationships between abstract symbols. The application focuses on Relational Fluency—the ability to manipulate mental models and derive non-explicit relationships across different frames of reference.

## Core Logic Modules

The application includes several distinct engines for generating relational problems:

  * **Linear Relation:** Generates sequences based on magnitude (Greater Than / Less Than). The user must determine the relationship between two non-adjacent items in the sequence.
  * **Distinction:** Generates chains of identity (Same / Different). The user must track the changing truth value across multiple steps to determine if item A is the same as item Z.
  * **Hierarchy:** Simulates containment relationships (Category A contains Category B). The user must verify if specific items belong to broader categories within a nested structure.
  * **Spatial 2D:** Places items on a grid using cardinal directions (North, South, East, West). The user must calculate the relative position between two distant points.
  * **Spatial 3D:** Extends the 2D grid into three dimensions, adding "Above" and "Below" axes to the relational calculation.

## Advanced Mechanics

Users can enable specific modifiers to increase the complexity of the derivation tasks:

  * **Cipher Mode:** Replaces standard relational keywords (e.g., "North," "Inside," "Greater") with randomly generated nonsense words. This requires the user to learn and maintain a lexicon while performing logic operations.
  * **Deictic Perspective:** Shifts the frame of reference from an allocentric map (top-down view) to an egocentric view. The user must calculate the location of an object relative to a specific observer's position and heading.
  * **Path Integration (Movement):** Adds dynamic movement instructions to spatial tasks. The user must track a coordinate position and heading through a series of vector changes (e.g., "Walk 1, Turn Right") before deriving the final relationship.
  * **Transformation (Context):** Introduces contextual cues (e.g., "Night Mode") that invert the required output. A mathematically correct "True" relationship may require a "False" input depending on the active context.
  * **Interference:** Inserts a distractor task (color/pattern matching) between the memorization of premises and the final query to test the stability of working memory.

## Configuration and Analytics

The application is fully configurable, allowing users to tailor the session to specific parameters:

  * **Blind Mode:** Hides the premises during the query phase, forcing reliance on working memory rather than visual scanning.
  * **Symbol Types:** Toggles between Emojis, Voronoi patterns, or text-based nonsense words to vary the abstraction level.
  * **Infinite vs. Timed:** Sessions can run indefinitely or against a countdown clock.
  * **Analytics:** The application stores local session history, visualizing performance over time. It tracks accuracy, average reaction time, and performance relative to the "depth" (number of premises) of the problem.

## Technology

  * **Framework:** Svelte
  * **Language:** TypeScript
  * **Visualization:** Chart.js
  * **Storage:** LocalStorage (Persists settings and history locally in the browser)

## Development

To run this project locally:

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```