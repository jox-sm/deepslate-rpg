import ProfileCard from "../components/adventures/cards/cards";

export default function Page() {
  return (
    <div className="mod2">
      <ProfileCard
      likes_count={0}
  image="/images/project.jpg"
  name="AI Chat System"
  description="A futuristic AI chat application with image generation and neon UI."
  tags={["NextJS", "Flask", "AI", "Tailwind"]}
/>
    </div>

  );
}