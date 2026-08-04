import { Modal } from '../components/Modal.jsx'

const APP_VERSION = '1.0'

function InfoModal({ title, onClose, children }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="info-body">{children}</div>
    </Modal>
  )
}

export function HelpModal({ onClose }) {
  return (
    <InfoModal title="Помощь" onClose={onClose}>
      <p className="info-hint">Коротко о том, как всё работает.</p>

      <h3 className="info-h">Найти пару</h3>
      <p className="info-p">Откройте Профиль → раздел «Пара». Введите юзернейм партнёра (например @alex) и отправьте запрос. Партнёр получит уведомление и сможет согласиться.</p>

      <h3 className="info-h">Создать событие</h3>
      <p className="info-p">На главном экране нажмите «+». Укажите название, время и описание. Можно создать событие без времени — тогда оно просто добавится в список.</p>

      <h3 className="info-h">Отметить приход</h3>
      <p className="info-p">Откройте событие и нажмите «Я пришёл». Когда оба отметятся — встреча считается состоявшейся.</p>

      <h3 className="info-h">Оценить встречу</h3>
      <p className="info-p">После встречи оставьте оценку и впечатление. Оценки влияют на средний балл и на ваше «настроение» в шапке приложения.</p>

      <h3 className="info-h">Изменить или перенести</h3>
      <p className="info-p">В событии нажмите «Изменить» или «Перенести» — партнёр получит запрос и должен его одобрить. Также можно предложить удалить событие.</p>

      <h3 className="info-h">Свободные дни</h3>
      <p className="info-p">В календаре отмечайте дни, когда вы свободны. Так вы увидите, когда свободны оба.</p>

      <h3 className="info-h">Статистика</h3>
      <p className="info-p">На вкладке «Статистика» — встречи, серия, оценки, дни недели, кто чаще предлагает и опаздывает.</p>
    </InfoModal>
  )
}

export function AboutModal({ onClose }) {
  return (
    <InfoModal title="О приложении" onClose={onClose}>
      <p className="info-p"><b>Universe of Plans</b> — приложение для пар, которое помогает планировать и запоминать совместные события.</p>

      <div className="info-list">
        <div className="info-row"><span>Версия</span><b>{APP_VERSION}</b></div>
        <div className="info-row"><span>Язык</span><b>Русский</b></div>
      </div>

      <p className="info-p">События, встречи, оценки и статистика — всё в одном месте, доступно вам и вашему партнёру.</p>

      <p className="info-p">Возникли вопросы или нашли ошибку? Напишите на <b>support@universe-of-plans.app</b>.</p>
    </InfoModal>
  )
}

export function PrivacyModal({ onClose }) {
  return (
    <InfoModal title="Политика конфиденциальности" onClose={onClose}>
      <h3 className="info-h">Какие данные мы собираем</h3>
      <p className="info-p">Мы храним то, что вы добавляете в приложение: адрес электронной почты, имя, аватар, данные о событиях, отметки прихода, оценки и настройки профиля.</p>

      <h3 className="info-h">Кто видит данные</h3>
      <p className="info-p">Данные вашей пары видны только вам и вашему партнёру. Мы не публикуем ваши данные и не передаём их третьим лицам для рекламы.</p>

      <h3 className="info-h">Как хранятся данные</h3>
      <p className="info-p">Данные хранятся на защищённых серверах (Supabase). Доступ к аккаунту защищён паролем, а к данным — правами, которые позволяют видеть только свою пару.</p>

      <h3 className="info-h">Удаление данных</h3>
      <p className="info-p">Вы можете удалить аккаунт в любой момент: Профиль → «Удалить аккаунт». После этого ваши данные и общие данные пары удаляются без возможности восстановления.</p>

      <h3 className="info-h">Контакты</h3>
      <p className="info-p">По вопросам конфиденциальности пишите на <b>support@universe-of-plans.app</b>.</p>

      <p className="info-p">Политика может обновляться. Продолжая пользоваться приложением, вы соглашаетесь с её условиями.</p>
    </InfoModal>
  )
}
