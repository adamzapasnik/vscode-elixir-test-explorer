defmodule AppOneTest do
  use ExUnit.Case
  doctest AppOne

  test "greets the world" do
    assert AppOne.hello() == :world
  end
end
