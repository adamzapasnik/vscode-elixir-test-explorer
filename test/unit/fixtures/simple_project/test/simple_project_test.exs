defmodule SimpleProjectTest do
  use ExUnit.Case
  doctest SimpleProject

  test "greets the world" do
    assert SimpleProject.hello() == :world
  end

  test "greets the underworld" do
    assert SimpleProject.hello() == :underworld
  end
end
