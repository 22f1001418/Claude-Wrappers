export default function Login() {
  return (
    <div className={styler.master}>
      <div className={styler.image}>
        <Image src="/path/to/image.jpg" alt="Login Image" width={500} height={500} />
      </div>
      <div className={styler.text}>
        <h2>Login to your account</h2>
        <div className={styler.google_auth}></div>
        <p>-OR-</p>
        <form className={styler.login_form}>
          <input type="email" placeholder="Email" required />
          <input type="password" placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}
