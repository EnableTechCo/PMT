import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectMenu } from "@/components/SelectMenu";

describe("SelectMenu", () => {
  it("opens and allows selecting an option", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <SelectMenu
        value="one"
        onChange={onChange}
        options={[
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "One" }));
    await user.click(screen.getByRole("option", { name: "Two" }));

    expect(onChange).toHaveBeenCalledWith("two");
  });
});
