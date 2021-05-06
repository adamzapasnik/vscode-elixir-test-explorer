defmodule SimpleProjectTest.NestedTest do
  use ExUnit.Case

  test "greets the world from a nested directory" do
    assert SimpleProject.NestedDir.hello() == :nested
  end
end
