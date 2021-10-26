import './style.css';
import { Shadertoy } from '../lib/Shadertoy';

const app = document.querySelector<HTMLDivElement>('#app')!;
const shadertoy = await Shadertoy.Create( app );
shadertoy.SetInputMedia( '/media/channel.jpg' ); // Set media url as iChannel0
await shadertoy.GetCodeByID( 'llj3zV' );
await shadertoy.InitRenderer();
shadertoy.Render();