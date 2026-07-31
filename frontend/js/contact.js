async function submitForm(data) {
  const turnstileToken = data['cf-turnstile-response'];
  if (turnstileToken) delete data['cf-turnstile-response'];

  const headers = { 'Content-Type': 'application/json' };
  if (turnstileToken) headers['cf-turnstile-response'] = turnstileToken;

  const response = await fetch(`${window.APP_CONFIG?.API_BASE_URL || ''}/api/contact`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  const resData = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = resData?.error?.message || 'Unable to send your inquiry.';
    throw new Error(errorMsg);
  }

  return resData;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const button = form.querySelector('.contact-submit');
  const message = form.querySelector('.form-message');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.checkValidity()) return form.reportValidity();
    const data = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    button.classList.remove('is-success');
    button.classList.add('is-loading');
    message.textContent = '';
    message.classList.remove('is-error');

    try {
      await submitForm(data);
      button.classList.remove('is-loading');
      button.classList.add('is-success');
      message.textContent = 'Merci — votre demande est en cours d’envoi.';
      form.reset();
      window.setTimeout(() => { button.classList.remove('is-success'); button.disabled = false; }, 1800);
    } catch (error) {
      button.classList.remove('is-loading');
      button.disabled = false;
      message.textContent = error.message || 'Une erreur est survenue. Veuillez réessayer.';
      message.classList.add('is-error');
    }
  });
});
