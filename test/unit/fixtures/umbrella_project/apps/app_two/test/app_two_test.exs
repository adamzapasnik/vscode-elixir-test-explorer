defmodule AppTwoTest do
  use ExUnit.Case
  doctest AppTwo

  test "greets the world" do
    assert AppTwo.hello() == :world
  end
end
