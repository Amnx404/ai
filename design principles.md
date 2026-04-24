# UI Design Principles

## 1. Unified Components (Shadcn UI)
Always prioritize using existing UI library components located in `src/components/ui/` rather than building raw HTML elements (`<button>`, `<div>` cards, `<input>`).

- **Buttons:** Use the `<Button>` component from `~/components/ui/button`. It supports standard `variant` (`default`, `secondary`, `outline`, `ghost`, `destructive`) and `size` props. Use the `asChild` prop if you need to wrap a `<Link>` or an `<a>` tag.
- **Cards:** Use `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, and `<CardContent>` from `~/components/ui/card` to build containers, dashboard widgets, and grouped content.
- **Forms:** Always use `<Input>` and `<Label>` components instead of generic text inputs to maintain consistent borders, padding, and focus states across the app.

## 2. Consistency Over Customization
When designing new pages or features, reuse the structural patterns established in the admin layout:
- **Spacing:** Stick to the Tailwind default spacing scale (`p-4`, `p-6`, `mb-8`, etc.).
- **Typography:** Ensure headers match the established sizing (e.g., `text-2xl font-bold text-gray-900` for page titles).
- **Interactions:** Hover states and transitions should rely on the default variants provided by the UI components (e.g., `hover:bg-gray-50` inside the `outline` button variant).

## 3. Light Theme Default (Admin Interface)
The administrative dashboard and configuration sections must maintain a clean, high-contrast, light background (`bg-gray-50`, `bg-white`).
- Do not mix dark-mode backgrounds or heavy glassmorphism inside the admin UI unless specifically dictated.
- A comprehensive Dark Mode will be added later as a global toggle. Until then, keep the admin clean and bright.

## 4. Responsive Design
All structural grids and headers should utilize responsive Tailwind prefixes (`sm:`, `md:`, `lg:`) to gracefully stack elements on smaller screens (e.g., using `flex-col sm:flex-row`). Always test your UI changes on mobile viewports.
