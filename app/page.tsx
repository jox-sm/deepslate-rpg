import CardsGridWrapper from '@/components/adventures/cards/cards-grid-wrapper';
import style from '@/styles/pages/home.module.css';

export default function Page() {
  return (
    <div className={style.container}>
      <CardsGridWrapper />
    </div>
  );
}
