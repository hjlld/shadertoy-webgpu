import './style.css';
import { Shadertoy } from '../lib/Shadertoy';

const app = document.querySelector<HTMLDivElement>('#app')!;
const shadertoy = await Shadertoy.Create( app );
shadertoy.SetInputMedia( '/media/channel0.mp3' );
await shadertoy.GetCodeByID( '4ljGD1' );
await shadertoy.InitRenderer();
shadertoy.Render();