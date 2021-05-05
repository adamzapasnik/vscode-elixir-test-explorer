We need a tree data structure to store graph of tests.

For a simple project the tree structure looks like this:

simple_project (test suite root)

- file1.exs (test suite)
  -- test1 (test)

For an umbrella project, the tree structure looks like this:

umbrella_project_1 (test suite root)

- file1.exs (test suite)
  -- test1 (test)

umbrella_project_2 (test suite root)

- file1.exs (test suite)
  -- test1 (test)

Operations:

- Rerun all suite roots
  -- nuke old roots
  -- add new roots

- Rerun suite root (all tests inside root)
  -- rerun suite with id x
  -- replace node x with new results

- Rerun suite (all tests inside a file)
  -- Rerun a specific test
  -- Replace leaf node only

Step one:
Build graph structure of mix parse result
Given graph, build test-explorer abstraction
